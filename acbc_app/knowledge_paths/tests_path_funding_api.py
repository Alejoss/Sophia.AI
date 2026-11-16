from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from knowledge_paths.models import PathPledge
from knowledge_paths.services.proposal_service import create_draft, open_proposal
from payments.bch_client import BchTokenInfo, BchTransaction, BchTxOutput, parse_unspent

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

        hidden = self.client.get(reverse('knowledge_paths:path-proposal-list'))
        self.assertEqual(hidden.data, [])
        mine = self.client.get(reverse('knowledge_paths:path-proposal-list') + '?mine=1')
        self.assertEqual(mine.data[0]['id'], proposal_id)

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
