from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from knowledge_paths.models import PathPledge, PathProposal
from knowledge_paths.services.proposal_service import create_draft, open_proposal
from payments.bch_cashaddr import encode_cashaddr
from payments.bch_client import (
    BchApiError,
    BchTokenInfo,
    BchTransaction,
    BchTxInput,
    BchTxOutput,
    parse_unspent,
)

PAYOUT = 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a'
WALLET = 'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy'
CATEGORY = 'ab' * 32


def _txid(byte: int) -> str:
    return f'{byte:02x}' * 32


class FakeChain:
    def __init__(self, transactions):
        self.transactions = transactions

    def get_transaction(self, txid, **kwargs):
        return self.transactions[txid]


class PathFundingApiTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username='author', password='secret')
        self.client = APIClient()
        self.deadline = (timezone.now() + timedelta(days=10)).replace(microsecond=0)

    def test_a_rejected_login_token_still_shows_an_open_investigation(self):
        proposal = create_draft(
            author=self.author,
            title='Public',
            pitch='Pitch',
            goal_sats=100000,
            deadline=self.deadline,
            author_payout_address=PAYOUT,
        )
        proposal.status = PathProposal.STATUS_OPEN
        proposal.save(update_fields=['status'])
        response = APIClient().get(
            reverse('knowledge_paths:path-proposal-detail', args=[proposal.pk]),
            HTTP_AUTHORIZATION='Bearer not-a-real-token',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['title'], 'Public')

    def test_an_open_investigation_keeps_its_title_editable_and_its_goal_fixed(self):
        proposal = create_draft(
            author=self.author,
            title='Public',
            pitch='Pitch',
            goal_sats=100000,
            deadline=self.deadline,
            author_payout_address=PAYOUT,
        )
        proposal.status = PathProposal.STATUS_OPEN
        proposal.save(update_fields=['status'])
        self.client.force_authenticate(self.author)
        renamed = self.client.patch(
            reverse('knowledge_paths:path-proposal-detail', args=[proposal.pk]),
            {'title': 'Renamed', 'pitch': 'A clearer pitch'},
            format='json',
        )
        self.assertEqual(renamed.status_code, 200, renamed.data)
        self.assertEqual(renamed.data['title'], 'Renamed')
        self.assertEqual(renamed.data['pitch'], 'A clearer pitch')
        self.assertEqual(renamed.data['goal_sats'], 100000)

        blocked = self.client.patch(
            reverse('knowledge_paths:path-proposal-detail', args=[proposal.pk]),
            {'title': 'Renamed', 'pitch': 'A clearer pitch', 'goal_sats': 50000},
            format='json',
        )
        self.assertEqual(blocked.status_code, 400, blocked.data)

    @override_settings(BCH_NETWORK='mainnet')
    def test_a_draft_saves_every_field(self):
        self.client.force_authenticate(self.author)
        created = self.client.post(
            reverse('knowledge_paths:path-proposal-list'),
            {
                'title': 'Draft',
                'pitch': 'Pitch',
                'goal_sats': 20000,
                'deadline': self.deadline.isoformat(),
            },
            format='json',
        )
        later = (self.deadline + timedelta(days=2)).isoformat()
        saved = self.client.patch(
            reverse('knowledge_paths:path-proposal-detail', args=[created.data['id']]),
            {
                'title': 'Revised',
                'pitch': 'Revised pitch',
                'goal_sats': 30000,
                'deadline': later,
                'author_payout_address': PAYOUT,
            },
            format='json',
        )
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(saved.data['title'], 'Revised')
        self.assertEqual(saved.data['pitch'], 'Revised pitch')
        self.assertEqual(saved.data['goal_sats'], 30000)
        self.assertEqual(saved.data['author_payout_address'], PAYOUT)

    def test_bch_price_returns_the_client_rate(self):
        fake = FakeChain({})
        fake.get_bch_usd_rate = lambda: Decimal('512.5')
        with patch('knowledge_paths.views_funding.build_bch_client', return_value=fake):
            response = self.client.get(reverse('knowledge_paths:path-proposal-bch-price'))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['usd_per_bch'], '512.5')

    def test_create_open_and_record_a_pledge(self):
        self.client.force_authenticate(self.author)
        created = self.client.post(
            reverse('knowledge_paths:path-proposal-list'),
            {
                'title': 'Campaign',
                'pitch': 'Pitch',
                'goal_sats': 20000,
                'deadline': self.deadline.isoformat(),
                'author_payout_address': PAYOUT,
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.data)
        proposal_id = created.data['id']
        self.assertEqual(created.data['status'], 'draft')

        anonymous = APIClient().get(reverse('knowledge_paths:path-proposal-list'))
        self.assertEqual(anonymous.data, [])
        mine = self.client.get(reverse('knowledge_paths:path-proposal-list'))
        self.assertEqual(mine.data[0]['id'], proposal_id)
        self.assertEqual(mine.data[0]['status'], 'draft')

        genesis = BchTransaction(
            txid=_txid(4),
            timestamp=1,
            confirmations=1,
            outputs=[
                BchTxOutput(
                    address=PAYOUT,
                    amount_sats=1000,
                    vout=0,
                    token=BchTokenInfo(CATEGORY, 'minting', '00'),
                )
            ],
        )
        with patch('knowledge_paths.views_funding.build_bch_client', return_value=FakeChain({_txid(4): genesis})):
            opened = self.client.post(
                reverse('knowledge_paths:path-proposal-open', args=[proposal_id]),
                {'campaign_txid': _txid(4), 'campaign_vout': 0},
                format='json',
            )
        self.assertEqual(opened.status_code, 200, opened.data)
        self.assertEqual(opened.data['status'], 'open')
        self.assertEqual(opened.data['token_category'], CATEGORY)
        self.assertEqual(opened.data['contract_address'], PAYOUT)

        public = APIClient().get(reverse('knowledge_paths:path-proposal-list'))
        self.assertEqual(public.data[0]['id'], proposal_id)

        receipt = proposal_id.to_bytes(8, 'little').hex() + (10000).to_bytes(8, 'little').hex()
        pledge = BchTransaction(
            txid=_txid(5),
            timestamp=2,
            confirmations=1,
            outputs=[
                BchTxOutput(
                    address=PAYOUT,
                    amount_sats=11000,
                    vout=0,
                    token=BchTokenInfo(CATEGORY, 'minting', '00'),
                ),
                BchTxOutput(
                    address=WALLET,
                    amount_sats=1000,
                    vout=1,
                    token=BchTokenInfo(CATEGORY, 'none', receipt),
                ),
            ],
        )
        with patch('knowledge_paths.views_funding.build_bch_client', return_value=FakeChain({_txid(5): pledge})):
            recorded = APIClient().post(
                reverse('knowledge_paths:path-proposal-pledges', args=[proposal_id]),
                {'txid': _txid(5)},
                format='json',
            )
        self.assertEqual(recorded.status_code, 200, recorded.data)
        self.assertEqual(recorded.data['raised_sats'], 10000)
        self.assertEqual(len(recorded.data['pledges']), 1)

        campaign = BchTransaction(
            txid=_txid(5),
            timestamp=2,
            confirmations=1,
            outputs=[
                BchTxOutput(
                    address=PAYOUT,
                    amount_sats=11000,
                    vout=0,
                    token=BchTokenInfo(CATEGORY, 'minting', '00'),
                )
            ],
        )
        pledge_row = PathPledge.objects.get(proposal_id=proposal_id)
        with patch('knowledge_paths.views_funding.build_bch_client', return_value=FakeChain({_txid(5): campaign})):
            refund = self.client.post(
                reverse('knowledge_paths:path-proposal-refund', args=[proposal_id]),
                {'pledge_id': pledge_row.pk},
                format='json',
            )
        self.assertEqual(refund.status_code, 200, refund.data)
        self.assertEqual(refund.data['action'], 'refund')
        self.assertEqual(refund.data['campaign']['satoshis'], 11000)
        self.assertEqual(refund.data['nft']['commitment'], receipt)
        self.assertEqual(refund.data['constructor_args'][0], proposal_id)

    def test_contract_endpoint_returns_the_compiled_artifact(self):
        response = self.client.get(reverse('knowledge_paths:path-proposal-contract'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['artifact']['contractName'], 'PathFunding')
        self.assertEqual(response.data['dust_sats'], 1000)
        self.assertEqual(response.data['min_pledge_sats'], 10000)

    def test_utxo_endpoint_returns_wallet_coins(self):
        class UtxoChain:
            def list_unspent(self, address):
                self.address = address
                return [{'txid': _txid(3), 'vout': 1, 'satoshis': 50000, 'token': None}]

        chain = UtxoChain()
        with patch('knowledge_paths.views_funding.build_bch_client', return_value=chain):
            response = self.client.get(
                reverse('knowledge_paths:path-proposal-utxos'),
                {'address': WALLET},
            )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['utxos'][0]['satoshis'], 50000)
        self.assertEqual(chain.address, WALLET)

    def test_parse_unspent_keeps_token_data(self):
        parsed = parse_unspent({
            'tx_hash': _txid(6),
            'tx_pos': 2,
            'value': 1000,
            'token_data': {
                'category': CATEGORY,
                'amount': '0',
                'nft': {'capability': 'none', 'commitment': 'abcd'},
            },
        })
        self.assertEqual(parsed['vout'], 2)
        self.assertEqual(parsed['token']['commitment'], 'abcd')

    @override_settings(BCH_NETWORK='chipnet')
    def test_cashout_address_is_saved_after_the_draft(self):
        self.client.force_authenticate(self.author)
        created = self.client.post(
            reverse('knowledge_paths:path-proposal-list'),
            {
                'title': 'Later payout',
                'pitch': 'Pitch',
                'goal_sats': 20000,
                'deadline': self.deadline.isoformat(),
            },
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['author_payout_address'], '')
        self.assertEqual(created.data['network_prefix'], 'bchtest')
        proposal_id = created.data['id']

        wrong_network = self.client.patch(
            reverse('knowledge_paths:path-proposal-detail', args=[proposal_id]),
            {'author_payout_address': PAYOUT},
            format='json',
        )
        self.assertEqual(wrong_network.status_code, 400, wrong_network.data)

        chipnet = encode_cashaddr('bchtest', 0, bytes.fromhex('11' * 20))
        saved = self.client.patch(
            reverse('knowledge_paths:path-proposal-detail', args=[proposal_id]),
            {'author_payout_address': chipnet},
            format='json',
        )
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(saved.data['author_payout_address'], chipnet)

    def test_claim_spec_requires_a_funded_campaign(self):
        proposal = open_proposal(
            create_draft(
                author=self.author,
                title='Open',
                pitch='Open',
                goal_sats=10000,
                deadline=self.deadline,
                author_payout_address=PAYOUT,
            ),
            campaign_txid=_txid(1),
            campaign_vout=0,
            at=self.deadline - timedelta(days=1),
        )
        response = self.client.post(reverse('knowledge_paths:path-proposal-claim', args=[proposal.pk]), {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_opening_publishes_the_signed_payment(self):
        self.client.force_authenticate(self.author)
        proposal = create_draft(
            author=self.author,
            title='Open',
            pitch='Open',
            goal_sats=10000,
            deadline=self.deadline,
            author_payout_address=PAYOUT,
        )
        genesis = BchTransaction(
            txid=_txid(4),
            timestamp=1,
            confirmations=0,
            outputs=[
                BchTxOutput(
                    address=PAYOUT,
                    amount_sats=1000,
                    vout=0,
                    token=BchTokenInfo(CATEGORY, 'minting', '00'),
                )
            ],
        )

        class Chain:
            def publish(self, raw_tx):
                self.raw_tx = raw_tx
                return genesis

        chain = Chain()
        with patch('knowledge_paths.views_funding.build_bch_client', return_value=chain):
            opened = self.client.post(
                reverse('knowledge_paths:path-proposal-open', args=[proposal.pk]),
                {'campaign_txid': _txid(4), 'campaign_vout': 0, 'raw_tx': 'ab' * 40},
                format='json',
            )
        self.assertEqual(opened.status_code, 200, opened.data)
        self.assertEqual(chain.raw_tx, 'ab' * 40)
        self.assertEqual(opened.data['status'], 'open')

    def test_recording_a_signed_pledge_publishes_it(self):
        proposal = open_proposal(
            create_draft(
                author=self.author,
                title='Open',
                pitch='Open',
                goal_sats=10000,
                deadline=self.deadline,
                author_payout_address=PAYOUT,
            ),
            campaign_txid=_txid(1),
            campaign_vout=0,
            at=self.deadline - timedelta(days=1),
        )

        class Chain:
            def publish(self, raw_tx):
                self.raw_tx = raw_tx
                return BchTransaction(txid=_txid(5), timestamp=1, confirmations=0, outputs=[])

        chain = Chain()
        with patch('knowledge_paths.views_funding.build_bch_client', return_value=chain):
            recorded = self.client.post(
                reverse('knowledge_paths:path-proposal-pledges', args=[proposal.pk]),
                {'txid': _txid(5), 'raw_tx': 'cd' * 40},
                format='json',
            )
        self.assertEqual(recorded.status_code, 200, recorded.data)
        self.assertEqual(chain.raw_tx, 'cd' * 40)

    def test_a_missing_opening_payment_does_not_dump_node_errors(self):
        self.client.force_authenticate(self.author)
        proposal = create_draft(
            author=self.author,
            title='Open',
            pitch='Open',
            goal_sats=10000,
            deadline=self.deadline,
            author_payout_address=PAYOUT,
        )

        class Chain:
            def get_transaction(self, txid, **kwargs):
                raise BchApiError(
                    "Electrum error: {'code': 2, 'message': 'No such mempool or blockchain transaction.'}"
                )

        with patch('knowledge_paths.views_funding.build_bch_client', return_value=Chain()):
            opened = self.client.post(
                reverse('knowledge_paths:path-proposal-open', args=[proposal.pk]),
                {'campaign_txid': _txid(9), 'campaign_vout': 0},
                format='json',
            )
        self.assertEqual(opened.status_code, 502)
        self.assertEqual(opened.data['code'], 'not_published')
        self.assertNotIn('Electrum', opened.data['error'])

    def _open_campaign(self):
        return open_proposal(
            create_draft(
                author=self.author,
                title='Open',
                pitch='Open',
                goal_sats=100000,
                deadline=self.deadline,
                author_payout_address=PAYOUT,
            ),
            campaign_txid=_txid(1),
            campaign_vout=0,
            contract_address=PAYOUT,
            token_category=CATEGORY,
            at=self.deadline - timedelta(days=1),
        )

    def test_a_published_expire_transaction_closes_an_underfunded_campaign(self):
        proposal = self._open_campaign()
        expired = BchTransaction(
            txid=_txid(5),
            timestamp=1,
            confirmations=1,
            outputs=[
                BchTxOutput(
                    address=PAYOUT,
                    amount_sats=1000,
                    vout=0,
                    token=BchTokenInfo(CATEGORY, 'minting', '02'),
                ),
            ],
        )

        class Chain:
            def publish(self, raw_tx):
                return expired

        with patch('knowledge_paths.views_funding.build_bch_client', return_value=Chain()):
            recorded = self.client.post(
                reverse('knowledge_paths:path-proposal-pledges', args=[proposal.pk]),
                {'txid': _txid(5), 'raw_tx': 'ee' * 40},
                format='json',
            )
        self.assertEqual(recorded.status_code, 200, recorded.data)
        self.assertEqual(recorded.data['status'], 'expired')
        self.assertEqual(recorded.data['raised_sats'], 0)

    def test_a_published_claim_settles_the_pool_after_the_goal(self):
        proposal = self._open_campaign()
        proposal.status = PathProposal.STATUS_FUNDED
        proposal.raised_sats = proposal.goal_sats
        proposal.save(update_fields=['status', 'raised_sats'])
        PathPledge.objects.create(
            proposal=proposal,
            wallet_address=WALLET,
            amount_sats=proposal.goal_sats,
            pledge_txid=_txid(2),
            vout=1,
            nft_category=CATEGORY,
            nft_commitment='00' * 16,
            nft_txid=_txid(2),
            nft_vout=1,
            status=PathPledge.STATUS_CONFIRMED,
        )
        claimed = BchTransaction(
            txid=_txid(8),
            timestamp=1,
            confirmations=1,
            outputs=[BchTxOutput(address=PAYOUT, amount_sats=101000, vout=0)],
            inputs=[BchTxInput(txid=_txid(1), vout=0)],
        )

        class Chain:
            def publish(self, raw_tx):
                return claimed

        with patch('knowledge_paths.views_funding.build_bch_client', return_value=Chain()):
            recorded = self.client.post(
                reverse('knowledge_paths:path-proposal-pledges', args=[proposal.pk]),
                {'txid': _txid(8), 'raw_tx': 'ff' * 40},
                format='json',
            )
        self.assertEqual(recorded.status_code, 200, recorded.data)
        self.assertEqual(recorded.data['status'], 'claimed')
        self.assertEqual(recorded.data['pledges'][0]['status'], 'settled')

    def test_claim_and_refund_descriptions_follow_the_campaign_without_a_wallet(self):
        proposal = self._open_campaign()
        proposal.status = PathProposal.STATUS_FUNDED
        proposal.save(update_fields=['status'])
        coin = BchTransaction(
            txid=_txid(1),
            timestamp=1,
            confirmations=1,
            outputs=[
                BchTxOutput(
                    address=PAYOUT,
                    amount_sats=101000,
                    vout=0,
                    token=BchTokenInfo(CATEGORY, 'minting', '01'),
                ),
            ],
        )

        class Chain:
            def get_transaction(self, txid, **kwargs):
                return coin

        with patch('knowledge_paths.views_funding.build_bch_client', return_value=Chain()):
            claim = self.client.post(
                reverse('knowledge_paths:path-proposal-claim', args=[proposal.pk]),
                {},
                format='json',
            )
        self.assertEqual(claim.status_code, 200, claim.data)
        self.assertEqual(claim.data['action'], 'claim')
        self.assertEqual(claim.data['author_payout_address'], PAYOUT)
        self.assertEqual(claim.data['campaign']['commitment'], '01')
        self.assertEqual(claim.data['campaign']['satoshis'], 101000)

        proposal.status = PathProposal.STATUS_EXPIRED
        proposal.save(update_fields=['status'])
        pledge = PathPledge.objects.create(
            proposal=proposal,
            wallet_address=WALLET,
            amount_sats=10000,
            pledge_txid=_txid(3),
            vout=1,
            nft_category=CATEGORY,
            nft_commitment='11' * 16,
            nft_txid=_txid(3),
            nft_vout=1,
            status=PathPledge.STATUS_CONFIRMED,
        )
        with patch('knowledge_paths.views_funding.build_bch_client', return_value=Chain()):
            refund = self.client.post(
                reverse('knowledge_paths:path-proposal-refund', args=[proposal.pk]),
                {'pledge_id': pledge.pk},
                format='json',
            )
            blocked = self.client.post(
                reverse('knowledge_paths:path-proposal-claim', args=[proposal.pk]),
                {},
                format='json',
            )
        self.assertEqual(refund.status_code, 200, refund.data)
        self.assertEqual(refund.data['action'], 'refund')
        self.assertEqual(refund.data['nft']['amount_sats'], 10000)
        self.assertEqual(blocked.status_code, 400)
