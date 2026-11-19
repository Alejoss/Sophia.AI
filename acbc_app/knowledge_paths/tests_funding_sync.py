from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from knowledge_paths.models import KnowledgePath, Node, PathPledge, PathProposal
from knowledge_paths.serializers import KnowledgePathCreateSerializer
from knowledge_paths.services.access_service import user_has_path_access
from knowledge_paths.services.funding_sync import apply_transaction, sync_proposal
from knowledge_paths.services.proposal_service import (
    create_draft,
    open_proposal,
)
from payments.bch_cashaddr import encode_cashaddr
from payments.bch_client import (
    BchApiError,
    BchElectrumClient,
    BchPublicClient,
    BchTokenInfo,
    BchTransaction,
    BchTxInput,
    BchTxOutput,
)

PAYOUT = 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a'
WALLET = 'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy'
CATEGORY = 'cd' * 32
CONTRACT = 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a'


def _txid(byte: int) -> str:
    return f'{byte:02x}' * 32


def _receipt(proposal_id: int, amount: int) -> str:
    return proposal_id.to_bytes(8, 'little').hex() + amount.to_bytes(8, 'little').hex()


def _tx(txid, outputs, inputs=(), confirmations=1):
    return BchTransaction(
        txid=txid,
        timestamp=1,
        confirmations=confirmations,
        outputs=list(outputs),
        inputs=list(inputs),
    )


class FundingSyncTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username='author', password='secret')
        self.learner = User.objects.create_user(username='learner', password='secret')
        self.now = timezone.now().replace(microsecond=0)
        self.proposal = create_draft(
            author=self.author,
            title='Funded path',
            pitch='A pitch',
            goal_sats=20000,
            deadline=self.now + timedelta(days=7),
            author_payout_address=PAYOUT,
        )
        self.proposal = open_proposal(
            self.proposal,
            campaign_txid=_txid(1),
            campaign_vout=0,
            contract_address=CONTRACT,
            token_category=CATEGORY,
            at=self.now,
        )

    def _pledge_tx(self, txid, amount, commitment_state='00'):
        receipt = _receipt(self.proposal.pk, amount)
        return _tx(
            txid,
            outputs=[
                BchTxOutput(
                    address=CONTRACT,
                    amount_sats=1000 + amount,
                    vout=0,
                    token=BchTokenInfo(CATEGORY, 'minting', commitment_state),
                ),
                BchTxOutput(
                    address=WALLET,
                    amount_sats=1000,
                    vout=1,
                    token=BchTokenInfo(CATEGORY, 'none', receipt),
                ),
            ],
        )

    def test_apply_is_idempotent_and_confirms_on_the_second_pass(self):
        tx = self._pledge_tx(_txid(2), 10000)
        tx.confirmations = 0
        apply_transaction(self.proposal, tx)
        apply_transaction(self.proposal, tx)
        self.assertEqual(PathPledge.objects.filter(proposal=self.proposal).count(), 1)
        pledge = PathPledge.objects.get(proposal=self.proposal)
        self.assertEqual(pledge.status, PathPledge.STATUS_PENDING)

        tx.confirmations = 1
        apply_transaction(self.proposal, tx)
        pledge.refresh_from_db()
        self.proposal.refresh_from_db()
        self.assertEqual(pledge.status, PathPledge.STATUS_CONFIRMED)
        self.assertEqual(self.proposal.raised_sats, 10000)
        self.assertEqual(self.proposal.campaign_txid, _txid(2))
        self.assertEqual(PathPledge.objects.count(), 1)

    def test_crossing_pledge_funds_and_a_later_refund_is_ignored(self):
        apply_transaction(self.proposal, self._pledge_tx(_txid(2), 10000))
        apply_transaction(
            self.proposal,
            self._pledge_tx(_txid(3), 10000, commitment_state='01'),
        )
        self.proposal.refresh_from_db()
        self.assertEqual(self.proposal.status, PathProposal.STATUS_FUNDED)

        first = PathPledge.objects.get(nft_txid=_txid(2))
        refund = _tx(
            _txid(4),
            outputs=[
                BchTxOutput(
                    address=CONTRACT,
                    amount_sats=11000,
                    vout=0,
                    token=BchTokenInfo(CATEGORY, 'minting', '01'),
                ),
                BchTxOutput(address=WALLET, amount_sats=10000, vout=1),
            ],
            inputs=[
                BchTxInput(
                    txid=_txid(2),
                    vout=1,
                    token=BchTokenInfo(CATEGORY, 'none', first.nft_commitment),
                ),
            ],
        )
        apply_transaction(self.proposal, refund)
        first.refresh_from_db()
        self.proposal.refresh_from_db()
        self.assertEqual(first.status, PathPledge.STATUS_CONFIRMED)
        self.assertEqual(self.proposal.status, PathProposal.STATUS_FUNDED)

    def test_refund_before_the_goal_returns_the_pledge(self):
        apply_transaction(self.proposal, self._pledge_tx(_txid(2), 10000))
        pledge = PathPledge.objects.get()
        refund = _tx(
            _txid(4),
            outputs=[
                BchTxOutput(
                    address=CONTRACT,
                    amount_sats=1000,
                    vout=0,
                    token=BchTokenInfo(CATEGORY, 'minting', '00'),
                ),
                BchTxOutput(address=WALLET, amount_sats=10000, vout=1),
            ],
            inputs=[
                BchTxInput(
                    txid=pledge.nft_txid,
                    vout=pledge.nft_vout,
                    token=BchTokenInfo(CATEGORY, 'none', pledge.nft_commitment),
                ),
            ],
        )
        apply_transaction(self.proposal, refund)
        apply_transaction(self.proposal, refund)
        pledge.refresh_from_db()
        self.proposal.refresh_from_db()
        self.assertEqual(pledge.status, PathPledge.STATUS_REFUNDED)
        self.assertEqual(self.proposal.raised_sats, 0)
        self.assertEqual(self.proposal.status, PathProposal.STATUS_OPEN)

    def test_a_refund_without_input_token_data_still_returns_the_pledge(self):
        apply_transaction(self.proposal, self._pledge_tx(_txid(2), 10000))
        pledge = PathPledge.objects.get()
        refund = _tx(
            _txid(4),
            outputs=[
                BchTxOutput(
                    address=CONTRACT,
                    amount_sats=1000,
                    vout=0,
                    token=BchTokenInfo(CATEGORY, 'minting', '00'),
                ),
                BchTxOutput(address=WALLET, amount_sats=10000, vout=1),
            ],
            inputs=[
                BchTxInput(txid=pledge.nft_txid, vout=pledge.nft_vout),
            ],
        )
        apply_transaction(self.proposal, refund)
        pledge.refresh_from_db()
        self.proposal.refresh_from_db()
        self.assertEqual(pledge.status, PathPledge.STATUS_REFUNDED)
        self.assertEqual(self.proposal.raised_sats, 0)

    def test_a_refund_after_the_deadline_waits_until_the_campaign_is_expired(self):
        apply_transaction(self.proposal, self._pledge_tx(_txid(2), 10000))
        pledge = PathPledge.objects.get()
        self.proposal.deadline = self.now - timedelta(days=1)
        self.proposal.save(update_fields=['deadline'])
        refund = _tx(
            _txid(4),
            outputs=[
                BchTxOutput(
                    address=CONTRACT,
                    amount_sats=1000,
                    vout=0,
                    token=BchTokenInfo(CATEGORY, 'minting', '00'),
                ),
                BchTxOutput(address=WALLET, amount_sats=10000, vout=1),
            ],
            inputs=[
                BchTxInput(
                    txid=pledge.nft_txid,
                    vout=pledge.nft_vout,
                    token=BchTokenInfo(CATEGORY, 'none', pledge.nft_commitment),
                ),
            ],
        )
        apply_transaction(self.proposal, refund)
        pledge.refresh_from_db()
        self.proposal.refresh_from_db()
        self.assertEqual(pledge.status, PathPledge.STATUS_CONFIRMED)
        self.assertEqual(self.proposal.status, PathProposal.STATUS_OPEN)

        apply_transaction(self.proposal, _tx(
            _txid(5),
            outputs=[
                BchTxOutput(
                    address=CONTRACT,
                    amount_sats=11000,
                    vout=0,
                    token=BchTokenInfo(CATEGORY, 'minting', '02'),
                ),
            ],
        ))
        apply_transaction(self.proposal, refund)
        pledge.refresh_from_db()
        self.proposal.refresh_from_db()
        self.assertEqual(self.proposal.status, PathProposal.STATUS_EXPIRED)
        self.assertEqual(pledge.status, PathPledge.STATUS_REFUNDED)
        self.assertEqual(self.proposal.raised_sats, 0)

    def test_expire_and_claim_follow_the_chain(self):
        apply_transaction(self.proposal, self._pledge_tx(_txid(2), 10000))
        self.proposal.deadline = self.now - timedelta(days=1)
        self.proposal.save(update_fields=['deadline'])
        expire = _tx(
            _txid(5),
            outputs=[
                BchTxOutput(
                    address=CONTRACT,
                    amount_sats=11000,
                    vout=0,
                    token=BchTokenInfo(CATEGORY, 'minting', '02'),
                ),
            ],
            inputs=[BchTxInput(txid=_txid(2), vout=0, token=BchTokenInfo(CATEGORY, 'minting', '00'))],
        )
        apply_transaction(self.proposal, expire)
        self.proposal.refresh_from_db()
        self.assertEqual(self.proposal.status, PathProposal.STATUS_EXPIRED)

        funded = create_draft(
            author=self.author,
            title='Ready to claim',
            pitch='Ready',
            goal_sats=10000,
            deadline=self.now + timedelta(days=3),
            author_payout_address=PAYOUT,
        )
        funded = open_proposal(
            funded,
            campaign_txid=_txid(6),
            campaign_vout=0,
            contract_address=CONTRACT,
            token_category=CATEGORY,
            at=self.now,
        )
        self.proposal = funded
        apply_transaction(funded, self._pledge_tx(_txid(7), 10000, commitment_state='01'))
        funded.refresh_from_db()
        claim = _tx(
            _txid(8),
            outputs=[BchTxOutput(address=PAYOUT, amount_sats=11000, vout=0)],
            inputs=[BchTxInput(txid=_txid(7), vout=0)],
        )
        apply_transaction(funded, claim)
        funded.refresh_from_db()
        self.assertEqual(funded.status, PathProposal.STATUS_CLAIMED)
        self.assertEqual(funded.settlement_txid, _txid(8))
        self.assertTrue(
            funded.pledges.filter(status=PathPledge.STATUS_SETTLED).exists()
        )

    def test_sync_reads_history_oldest_first_without_duplicates(self):
        first = self._pledge_tx(_txid(2), 10000)
        second = self._pledge_tx(_txid(3), 10000, commitment_state='01')

        class FakeChain:
            def list_recent_transactions(self, address, limit=25):
                self.address = address
                return [second, first]

        sync_proposal(self.proposal, client=FakeChain())
        sync_proposal(self.proposal, client=FakeChain())
        self.proposal.refresh_from_db()
        self.assertEqual(self.proposal.pledges.count(), 2)
        self.assertEqual(self.proposal.status, PathProposal.STATUS_FUNDED)

    def test_electrum_verbose_transaction_keeps_tokens(self):
        client = BchElectrumClient('localhost', 1, use_ssl=False)
        parsed = client._parse_verbose_tx(
            _txid(9),
            {
                'time': 10,
                'confirmations': 2,
                'vin': [{
                    'txid': _txid(8),
                    'vout': 1,
                    'tokenData': {
                        'category': CATEGORY,
                        'amount': '0',
                        'nft': {'capability': 'none', 'commitment': '00'},
                    },
                }],
                'vout': [{
                    'n': 0,
                    'value': 0.00011,
                    'scriptPubKey': {'addresses': [CONTRACT]},
                    'tokenData': {
                        'category': CATEGORY,
                        'amount': '0',
                        'nft': {'capability': 'minting', 'commitment': '00'},
                    },
                }],
            },
        )
        self.assertEqual(parsed.outputs[0].token.capability, 'minting')
        self.assertEqual(parsed.outputs[0].amount_sats, 11000)
        self.assertEqual(parsed.inputs[0].vout, 1)
        self.assertEqual(parsed.inputs[0].token.commitment, '00')


class FundingAccessTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username='path-author', password='secret')
        self.learner = User.objects.create_user(username='learner', password='secret')
        self.now = timezone.now().replace(microsecond=0)
        self.proposal = open_proposal(
            create_draft(
                author=self.author,
                title='Gated path',
                pitch='Gated',
                goal_sats=10000,
                deadline=self.now + timedelta(days=4),
                author_payout_address=PAYOUT,
            ),
            campaign_txid=_txid(1),
            campaign_vout=0,
            contract_address=CONTRACT,
            token_category=CATEGORY,
            at=self.now,
        )
        self.path = KnowledgePath.objects.create(
            title='Lessons',
            description='Open to everyone',
            author=self.author,
        )
        Node.objects.create(
            knowledge_path=self.path,
            title='Lesson',
            media_type='TEXT',
            order=1,
        )

    def test_a_linked_path_stays_open_to_everyone(self):
        self.assertIsNone(self.proposal.knowledge_path_id)
        self.assertTrue(user_has_path_access(None, self.path))
        self.proposal.status = PathProposal.STATUS_FUNDED
        self.proposal.save(update_fields=['status'])
        from knowledge_paths.services.proposal_service import link_knowledge_path
        link_knowledge_path(self.proposal, self.path.pk)
        self.path.refresh_from_db()
        self.assertTrue(user_has_path_access(self.learner, self.path, wallet_address=WALLET))
        self.assertTrue(user_has_path_access(None, self.path))
        allowed = KnowledgePathCreateSerializer(
            instance=self.path,
            data={'title': self.path.title, 'description': self.path.description, 'is_visible': True},
            partial=True,
        )
        self.assertTrue(allowed.is_valid(), allowed.errors)


class CashAddrTokenTests(TestCase):
    def test_token_address_normalizes_to_the_same_locking_script(self):
        payload = bytes.fromhex('76a04053bda0a88bda5177b86a15c3b29f559873')
        # The known vector is already a valid hash; rebuild a token-aware address
        # from the decoded payload of the public test vector.
        from payments.bch_cashaddr import decode_cashaddr, normalize_cashaddr

        _prefix, _version, raw = decode_cashaddr(WALLET)
        token = encode_cashaddr('bitcoincash', 2, raw)
        self.assertEqual(normalize_cashaddr(token), WALLET)
        self.assertEqual(len(payload), 20)


class MissingCampaignTransactionTests(TestCase):
    def test_an_unknown_payment_is_not_described_as_a_campaign(self):
        client = BchPublicClient(api_base='https://api.blockchair.com/bitcoin-cash')
        client._get = lambda path: {'data': {}, 'context': {'results': 0}}
        with self.assertRaises(BchApiError) as caught:
            client.get_transaction('ab' * 32)
        self.assertIn('not on the Bitcoin Cash network', str(caught.exception))
