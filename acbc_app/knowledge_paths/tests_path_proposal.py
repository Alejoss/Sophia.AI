from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from knowledge_paths.models import KnowledgePath, PathPledge, PathProposal
from knowledge_paths.services.proposal_service import (
    ProposalError,
    cancel_draft,
    claim_proposal,
    confirm_pledge,
    create_draft,
    expire_if_due,
    link_knowledge_path,
    open_proposal,
    record_pledge,
    refund_pledge,
    terms_hash,
)
from payments.bch_cashaddr import encode_cashaddr

PAYOUT = 'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a'
WALLET = 'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy'
TX = 'ab' * 32
NFT_CATEGORY = 'cd' * 32
COMMITMENT = '000000000000000100000000000f4240'


def _txid(byte: int) -> str:
    return f'{byte:02x}' * 32


class PathProposalStateTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username='author', password='secret')
        self.supporter = User.objects.create_user(username='supporter', password='secret')
        self.now = timezone.now().replace(microsecond=0)
        self.deadline = self.now + timedelta(days=7)

    def _draft(self, **overrides):
        params = {
            'author': self.author,
            'title': 'Bitcoin for beginners',
            'pitch': 'A path we will write if funded.',
            'goal_sats': 100_000,
            'deadline': self.deadline,
            'author_payout_address': PAYOUT,
            'at': self.now,
        }
        params.update(overrides)
        return create_draft(**params)

    def _open(self, proposal=None, **overrides):
        proposal = proposal or self._draft()
        params = {
            'campaign_txid': TX,
            'campaign_vout': 0,
            'at': self.now,
        }
        params.update(overrides)
        return open_proposal(proposal, **params)

    def _pledge(self, proposal, *, amount=40_000, confirmations=1, nth=1, **overrides):
        params = {
            'amount_sats': amount,
            'pledge_txid': _txid(nth),
            'vout': 0,
            'wallet_address': WALLET,
            'nft_category': NFT_CATEGORY,
            'nft_commitment': COMMITMENT,
            'nft_txid': _txid(nth + 100),
            'nft_vout': 1,
            'confirmations': confirmations,
            'user': self.supporter,
            'at': self.now + timedelta(hours=nth),
        }
        params.update(overrides)
        return record_pledge(proposal, **params)

    def test_create_draft_does_not_create_a_knowledge_path(self):
        proposal = self._draft()
        self.assertEqual(proposal.status, PathProposal.STATUS_DRAFT)
        self.assertIsNone(proposal.knowledge_path_id)
        self.assertEqual(proposal.frozen_title, 'Bitcoin for beginners')
        self.assertEqual(proposal.frozen_pitch, 'A path we will write if funded.')
        self.assertEqual(proposal.terms_hash, '')
        self.assertEqual(proposal.deadline.microsecond, 0)

    def test_cancel_is_only_available_for_a_draft(self):
        proposal = cancel_draft(self._draft())
        self.assertEqual(proposal.status, PathProposal.STATUS_CANCELLED)
        opened = self._open()
        with self.assertRaises(ProposalError):
            cancel_draft(opened)

    def test_open_keeps_the_pitch_without_a_knowledge_path(self):
        proposal = self._open()
        self.assertIsNone(proposal.knowledge_path_id)
        self.assertEqual(proposal.status, PathProposal.STATUS_OPEN)
        self.assertEqual(proposal.frozen_title, 'Bitcoin for beginners')
        self.assertEqual(proposal.frozen_pitch, 'A path we will write if funded.')
        self.assertEqual(proposal.campaign_txid, TX)
        self.assertEqual(proposal.campaign_vout, 0)
        self.assertEqual(proposal.terms_hash, terms_hash(proposal))
        self.assertEqual(len(proposal.terms_hash), 64)

    def test_open_rejects_a_bad_address_a_past_deadline_and_a_second_open(self):
        with self.assertRaises(ProposalError):
            self._draft(author_payout_address='not-an-address')
        with self.assertRaises(ProposalError):
            self._draft(deadline=self.now - timedelta(minutes=1))
        proposal = self._open()
        with self.assertRaises(ProposalError):
            self._open(proposal)

    def test_open_requires_a_cashout_address(self):
        proposal = self._draft(author_payout_address='')
        self.assertEqual(proposal.author_payout_address, '')
        with self.assertRaises(ProposalError):
            self._open(proposal)

    def test_bchtest_payout_address_is_accepted(self):
        address = encode_cashaddr('bchtest', 0, bytes.fromhex('11' * 20))
        proposal = self._draft(author_payout_address=address)
        self.assertEqual(proposal.author_payout_address, address)

    def test_pending_pledge_does_not_count_until_it_is_confirmed(self):
        proposal = self._open()
        proposal, pledge = self._pledge(proposal, confirmations=0)
        self.assertEqual(pledge.status, PathPledge.STATUS_PENDING)
        self.assertEqual(proposal.raised_sats, 0)
        self.assertEqual(proposal.status, PathProposal.STATUS_OPEN)
        proposal = confirm_pledge(
            proposal,
            pledge,
            confirmations=1,
            at=self.now + timedelta(hours=2),
        )
        self.assertEqual(proposal.raised_sats, 40_000)
        self.assertEqual(proposal.status, PathProposal.STATUS_OPEN)

    def test_crossing_pledge_funds_the_campaign_and_closes_it(self):
        proposal = self._open()
        proposal, _first = self._pledge(proposal, amount=60_000, nth=1)
        self.assertEqual(proposal.status, PathProposal.STATUS_OPEN)
        proposal, _second = self._pledge(proposal, amount=40_000, nth=2)
        self.assertEqual(proposal.status, PathProposal.STATUS_FUNDED)
        self.assertEqual(proposal.raised_sats, 100_000)
        with self.assertRaises(ProposalError):
            self._pledge(proposal, amount=1_000, nth=3)

    def test_refund_while_open_returns_the_amount_to_the_pool(self):
        proposal = self._open()
        proposal, pledge = self._pledge(proposal, amount=25_000)
        proposal = refund_pledge(
            proposal,
            pledge,
            refund_txid=_txid(9),
            at=self.now + timedelta(hours=3),
        )
        pledge.refresh_from_db()
        self.assertEqual(pledge.status, PathPledge.STATUS_REFUNDED)
        self.assertEqual(pledge.refund_txid, _txid(9))
        self.assertEqual(proposal.raised_sats, 0)
        self.assertEqual(proposal.status, PathProposal.STATUS_OPEN)

    def test_refund_fails_once_the_campaign_is_funded(self):
        proposal = self._open()
        proposal, pledge = self._pledge(proposal, amount=100_000)
        self.assertEqual(proposal.status, PathProposal.STATUS_FUNDED)
        with self.assertRaises(ProposalError):
            refund_pledge(proposal, pledge, refund_txid=_txid(9), at=self.now)

    def test_deadline_expires_an_underfunded_campaign_and_still_allows_refunds(self):
        proposal = self._open()
        proposal, pledge = self._pledge(proposal, amount=10_000)
        after = self.deadline + timedelta(seconds=1)
        with self.assertRaises(ProposalError):
            self._pledge(proposal, nth=2, at=after)
        with self.assertRaises(ProposalError):
            refund_pledge(proposal, pledge, refund_txid=_txid(8), at=after)
        proposal = expire_if_due(proposal, at=after)
        self.assertEqual(proposal.status, PathProposal.STATUS_EXPIRED)
        proposal = refund_pledge(proposal, pledge, refund_txid=_txid(8), at=after)
        self.assertEqual(proposal.status, PathProposal.STATUS_EXPIRED)
        self.assertEqual(proposal.raised_sats, 0)
        with self.assertRaises(ProposalError):
            claim_proposal(proposal, settlement_txid=_txid(7))

    def test_deadline_on_a_funded_campaign_does_not_expire_it(self):
        proposal = self._open()
        proposal, _pledge = self._pledge(proposal, amount=100_000)
        after = self.deadline + timedelta(days=1)
        proposal = expire_if_due(proposal, at=after)
        self.assertEqual(proposal.status, PathProposal.STATUS_FUNDED)

    def test_the_author_links_a_path_only_after_the_goal(self):
        proposal = self._open()
        path = KnowledgePath.objects.create(title='The investigation', description='Lessons', author=self.author)
        with self.assertRaises(ProposalError):
            link_knowledge_path(proposal, path.pk)
        proposal, _pledge = self._pledge(proposal, amount=100_000)
        self.assertEqual(proposal.status, PathProposal.STATUS_FUNDED)
        linked = link_knowledge_path(proposal, path.pk)
        self.assertEqual(linked.knowledge_path_id, path.pk)
        other = User.objects.create_user(username='other-author', password='secret')
        foreign = KnowledgePath.objects.create(title='Not mine', author=other)
        with self.assertRaises(ProposalError):
            link_knowledge_path(linked, foreign.pk)

    def test_claim_settles_confirmed_pledges_and_keeps_the_raised_total(self):
        proposal = self._open()
        proposal, _pledge = self._pledge(proposal, amount=100_000)
        proposal = claim_proposal(proposal, settlement_txid=_txid(4))
        self.assertEqual(proposal.status, PathProposal.STATUS_CLAIMED)
        self.assertEqual(proposal.settlement_txid, _txid(4))
        self.assertEqual(proposal.raised_sats, 100_000)
        self.assertIsNone(proposal.knowledge_path_id)
        pledge = proposal.pledges.get()
        self.assertEqual(pledge.status, PathPledge.STATUS_SETTLED)
        with self.assertRaises(ProposalError):
            claim_proposal(proposal, settlement_txid=_txid(5))

    def test_a_pledge_confirms_after_the_campaign_is_closed(self):
        proposal = self._open()
        proposal, pledge = self._pledge(proposal, confirmations=0)
        proposal = expire_if_due(proposal, at=self.deadline + timedelta(seconds=1))
        proposal = confirm_pledge(proposal, pledge, confirmations=1, at=self.deadline)
        pledge.refresh_from_db()
        self.assertEqual(pledge.status, PathPledge.STATUS_CONFIRMED)
        self.assertEqual(proposal.status, PathProposal.STATUS_EXPIRED)
        self.assertEqual(proposal.raised_sats, 40_000)

    def test_duplicate_pledge_output_is_rejected(self):
        proposal = self._open()
        self._pledge(proposal, nth=1)
        with self.assertRaises(ProposalError):
            self._pledge(proposal, nth=1, nft_txid=_txid(200), nft_vout=2)

    def test_expire_recomputes_raised_and_funds_a_campaign_that_met_its_goal(self):
        proposal = self._open()
        proposal, pledge = self._pledge(proposal, amount=40_000)
        PathPledge.objects.filter(pk=pledge.pk).update(amount_sats=proposal.goal_sats)
        proposal = expire_if_due(proposal, at=self.deadline)
        self.assertEqual(proposal.status, PathProposal.STATUS_FUNDED)
        self.assertEqual(proposal.raised_sats, proposal.goal_sats)
