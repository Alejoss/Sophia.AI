"""Staff dashboard that reads and mints Sepolia knowledge-path credentials."""

import json
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from certificates.ethereum_client import EthereumRegistryError, _revert_message
from certificates.models import Certificate
from certificates.services.ethereum_credentials import credential_label
from content.models import Content, ContentProfile, ContentTranscript
from knowledge_paths.models import KnowledgePath, Node
from knowledge_paths.services.snapshot_publish import publish_knowledge_path_snapshot


RECIPIENT = "0x0000000000000000000000000000000000000001"


class FakeRegistry:
    def __init__(self):
        self.registered = set()
        self.tokens = {}
        self.rewards = {}
        self.calls = []
        self.registrar = False

    def checksum(self, value):
        if not isinstance(value, str) or len(value) != 42 or not value.startswith("0x"):
            raise EthereumRegistryError("La dirección del destinatario no es válida.")
        return value

    def status(self):
        return {
            "name": "ACBC Educational Credential",
            "symbol": "ACBC",
            "address": "0xf13a2ece9747Dd286fE3e1d5C6179A875c843944",
            "chainId": 11155111,
            "signer": "0xA75dA0D7DdEa2B5b343bf1b83f9D4474C1c7595C",
            "signerIsAdmin": True,
            "signerIsRegistrar": self.registrar,
        }

    def achievement(self, knowledge_path_id, version):
        return {"registered": (knowledge_path_id, version) in self.registered}

    def credential(self, issuance_label):
        token = self.tokens.get(issuance_label)
        if not token:
            return {"tokenId": None, "owner": None, "status": None}
        return token

    def reward_status(self):
        return {
            "reachable": True,
            "error": None,
            "name": "ACBC Completion Reward",
            "symbol": "ACBC",
            "address": "0x00000000000000000000000000000000000000aa",
            "signerIsMinter": True,
        }

    def reward_token(self, issuance_label):
        token = self.rewards.get(issuance_label)
        if not token:
            return {"tokenId": None, "owner": None}
        return token

    def mint_reward(self, recipient, issuance_label, uri):
        self.calls.append(("reward", recipient, issuance_label, uri))
        self.rewards[issuance_label] = {"tokenId": 3, "owner": recipient}
        return {
            "transactionHash": "0x" + "ef" * 32,
            "tokenId": 3,
            "roleTransaction": None,
        }

    def register_achievement(self, knowledge_path_id, version, snapshot_digest, uri):
        self.calls.append(("register", knowledge_path_id, version, snapshot_digest, uri))
        self.registered.add((knowledge_path_id, version))
        self.registrar = True
        return {"transactionHash": "0x" + "ab" * 32, "roleTransaction": "0x" + "11" * 32}

    def mint(
        self,
        recipient,
        issuance_label,
        knowledge_path_id,
        version,
        snapshot_digest,
        credential_digest,
        credential_uri,
    ):
        self.calls.append((
            "mint",
            recipient,
            issuance_label,
            knowledge_path_id,
            version,
            snapshot_digest,
            credential_digest,
            credential_uri,
        ))
        self.tokens[issuance_label] = {
            "tokenId": 7,
            "owner": recipient,
            "status": "valid",
        }
        return {
            "transactionHash": "0x" + "cd" * 32,
            "tokenId": 7,
            "roleTransaction": None,
        }


class EthereumCredentialDashboardTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin", "admin@example.com", "pass", is_staff=True)
        self.learner = User.objects.create_user("learner", "learner@example.com", "pass")
        self.author = User.objects.create_user("author", "author@example.com", "pass")
        self.path = KnowledgePath.objects.create(
            title="Introduction to Bitcoin",
            description="Desc",
            author=self.author,
        )
        content = Content.objects.create(
            media_type="VIDEO",
            original_title="Lesson",
            uploaded_by=self.author,
        )
        ContentTranscript.objects.create(
            content=content,
            processed_plain="Bitcoin is digital money.",
        )
        profile = ContentProfile.objects.create(
            content=content,
            user=self.author,
            title="Lesson",
        )
        Node.objects.create(
            knowledge_path=self.path,
            content_profile=profile,
            title="Lesson",
            description="Node",
            order=1,
            media_type="VIDEO",
        )
        self.snapshot, _created = publish_knowledge_path_snapshot(
            self.path,
            published_by=self.admin,
        )
        self.certificate = Certificate.objects.create(
            user=self.learner,
            knowledge_path=self.path,
        )
        self.api = APIClient()
        self.registry = FakeRegistry()
        self.client_patch = patch(
            "certificates.views_ethereum.get_registry_client",
            return_value=self.registry,
        )
        self.client_patch.start()
        self.addCleanup(self.client_patch.stop)

    def test_dashboard_reads_contract_and_lists_path_certificates(self):
        self.api.force_authenticate(user=self.admin)
        response = self.api.get("/api/certificates/ethereum/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["contract"]["name"], "ACBC Educational Credential")
        self.assertEqual(response.data["contract"]["symbol"], "ACBC")
        self.assertEqual(len(response.data["certificates"]), 1)
        row = response.data["certificates"][0]
        self.assertEqual(row["learner"], "learner")
        self.assertEqual(row["snapshotVersion"], 1)
        self.assertFalse(row["chain"]["achievementRegistered"])
        self.assertIsNone(row["chain"]["tokenId"])
        self.assertNotIn("private", json.dumps(response.data).lower())

    def test_non_staff_cannot_read_or_send(self):
        self.api.force_authenticate(user=self.learner)
        dashboard = self.api.get("/api/certificates/ethereum/")
        mint = self.api.post(
            f"/api/certificates/ethereum/{self.certificate.id}/mint/",
            {"recipient": RECIPIENT},
            format="json",
        )
        self.assertEqual(dashboard.status_code, 403)
        self.assertEqual(mint.status_code, 403)

    def test_mint_is_accepted_before_sepolia_confirms(self):
        from certificates.services.ethereum_jobs import _release

        self.api.force_authenticate(user=self.admin)
        self.registry.registered.add((
            f"sophia-acbc:knowledge-path:{self.path.id}",
            1,
        ))
        self.addCleanup(lambda: _release("mint", self.certificate.id))
        with patch("certificates.views_ethereum.jobs_run_inline", return_value=False), patch(
            "certificates.services.ethereum_jobs._start",
        ) as started:
            response = self.api.post(
                f"/api/certificates/ethereum/{self.certificate.id}/mint/",
                {"recipient": RECIPIENT},
                format="json",
            )
        self.assertEqual(response.status_code, 202, response.data)
        self.assertTrue(response.data["pending"])
        self.certificate.refresh_from_db()
        self.assertEqual(self.certificate.ethereum_status, "minting")
        self.assertEqual(self.certificate.ethereum_recipient, RECIPIENT)
        started.assert_called_once()

    def test_register_then_mint_and_reread(self):
        self.api.force_authenticate(user=self.admin)
        blocked = self.api.post(
            f"/api/certificates/ethereum/{self.certificate.id}/mint/",
            {"recipient": RECIPIENT},
            format="json",
        )
        self.assertEqual(blocked.status_code, 400, blocked.data)
        self.assertIn("Registra la versión", blocked.data["error"])
        self.assertEqual(self.registry.calls, [])

        registered = self.api.post(
            f"/api/certificates/ethereum/{self.certificate.id}/register/",
        )
        self.assertEqual(registered.status_code, 200, registered.data)
        self.assertFalse(registered.data["alreadyRegistered"])
        self.assertEqual(registered.data["version"], 1)
        self.assertEqual(self.registry.calls[0][0], "register")
        self.assertEqual(self.registry.calls[0][2], 1)
        self.assertEqual(self.registry.calls[0][3], self.snapshot.digest)

        minted = self.api.post(
            f"/api/certificates/ethereum/{self.certificate.id}/mint/",
            {"recipient": RECIPIENT},
            format="json",
        )
        self.assertEqual(minted.status_code, 200, minted.data)
        self.assertEqual(minted.data["tokenId"], 7)
        self.assertFalse(minted.data["alreadyMinted"])
        mint_call = self.registry.calls[-1]
        self.assertEqual(mint_call[0], "mint")
        self.assertEqual(mint_call[1], RECIPIENT)
        self.assertEqual(mint_call[2], credential_label(self.certificate))
        self.assertEqual(mint_call[5], self.snapshot.digest)

        self.certificate.refresh_from_db()
        self.assertEqual(self.certificate.ethereum_token_id, 7)
        self.assertEqual(self.certificate.ethereum_status, "minted")
        self.assertEqual(self.certificate.blockchain_hash, "0x" + "cd" * 32)
        artifact = json.loads(self.certificate.credential_canonical)
        self.assertEqual(artifact["schemaVersion"], "sophia-acbc-credential-v1")
        self.assertEqual(artifact["recipient"], RECIPIENT)
        self.assertEqual(artifact["knowledgePathVersion"], 1)
        self.assertEqual(artifact["knowledgePathSnapshotHash"], self.snapshot.digest)
        self.assertNotIn("tokenId", artifact)

        again = self.api.post(
            f"/api/certificates/ethereum/{self.certificate.id}/mint/",
            {"recipient": RECIPIENT},
            format="json",
        )
        self.assertEqual(again.status_code, 200, again.data)
        self.assertTrue(again.data["alreadyMinted"])
        self.assertEqual(len([call for call in self.registry.calls if call[0] == "mint"]), 1)

        public = self.api.get(
            f"/api/certificates/ethereum/artifact/{self.certificate.certificate_id}/"
        )
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.content.decode("utf-8"), self.certificate.credential_canonical)

        listed = self.api.get("/api/certificates/ethereum/")
        row = listed.data["certificates"][0]
        self.assertTrue(row["chain"]["achievementRegistered"])
        self.assertEqual(row["chain"]["tokenId"], 7)
        self.assertEqual(row["chain"]["owner"], RECIPIENT)
        self.assertEqual(row["chain"]["status"], "valid")

    def test_mint_rejects_a_bad_address_and_a_missing_snapshot(self):
        self.api.force_authenticate(user=self.admin)
        self.registry.registered.add((
            f"sophia-acbc:knowledge-path:{self.path.id}",
            1,
        ))
        bad = self.api.post(
            f"/api/certificates/ethereum/{self.certificate.id}/mint/",
            {"recipient": "not-a-wallet"},
            format="json",
        )
        self.assertEqual(bad.status_code, 400)

        other = KnowledgePath.objects.create(title="Empty", description="", author=self.author)
        bare = Certificate.objects.create(user=self.learner, knowledge_path=other)
        missing = self.api.post(f"/api/certificates/ethereum/{bare.id}/register/")
        self.assertEqual(missing.status_code, 400)
        self.assertIn("snapshot", missing.data["error"])

    def test_reward_mints_without_registering_the_certificate(self):
        self.api.force_authenticate(user=self.admin)
        minted = self.api.post(
            f"/api/certificates/ethereum/{self.certificate.id}/reward/",
            {"recipient": RECIPIENT},
            format="json",
        )
        self.assertEqual(minted.status_code, 200, minted.data)
        self.assertEqual(minted.data["tokenId"], 3)
        self.assertFalse(minted.data["alreadyMinted"])
        self.assertEqual(self.registry.calls[0][0], "reward")
        self.assertIn("sophia-acbc:reward:", self.registry.calls[0][2])

        self.certificate.refresh_from_db()
        self.assertEqual(self.certificate.reward_token_id, 3)
        self.assertEqual(self.certificate.ethereum_token_id, None)
        self.assertEqual(self.registry.registered, set())

        metadata = self.api.get(
            f"/api/certificates/ethereum/reward/{self.certificate.certificate_id}/"
        )
        self.assertEqual(metadata.status_code, 200)
        self.assertIn("ACBC Completion Reward", metadata.data["name"])
        self.assertEqual(metadata.data["attributes"][1]["value"], 1)
        self.assertNotIn("image", metadata.data)

        listed = self.api.get("/api/certificates/ethereum/")
        self.assertEqual(listed.data["reward"]["name"], "ACBC Completion Reward")
        self.assertEqual(listed.data["certificates"][0]["reward"]["tokenId"], 3)
        self.assertIsNone(listed.data["certificates"][0]["chain"]["tokenId"])

    def test_reward_image_is_stored_and_returned_in_metadata(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.api.force_authenticate(user=self.admin)
        png = SimpleUploadedFile("reward.png", b"\x89PNG\r\n\x1a\n", content_type="image/png")
        uploaded = self.api.post(
            f"/api/certificates/ethereum/{self.certificate.id}/reward-image/",
            {"image": png},
            format="multipart",
        )
        self.assertEqual(uploaded.status_code, 200, uploaded.data)
        self.assertIn("/nft_rewards/", uploaded.data["rewardImage"])

        self.certificate.refresh_from_db()
        self.assertIn("nft_rewards/", self.certificate.reward_image.name)

        metadata = self.api.get(
            f"/api/certificates/ethereum/reward/{self.certificate.certificate_id}/"
        )
        self.assertEqual(metadata.data["image"], uploaded.data["rewardImage"])

        self.certificate.reward_image_uri = "ipfs://bafybeirewardimage"
        self.certificate.save(update_fields=["reward_image_uri"])
        pinned = self.api.get(
            f"/api/certificates/ethereum/reward/{self.certificate.certificate_id}/"
        )
        self.assertEqual(pinned.data["image"], "ipfs://bafybeirewardimage")


class EthereumRevertMessageTests(SimpleTestCase):
    def test_decodes_missing_registrar_role(self):
        raw = (
            "0xe2517d3f"
            "000000000000000000000000a75da0d7ddea2b5b343bf1b83f9d4474c1c7595c"
            "edcc084d3dcd65a1f7f23c65c46722faca6953d28e43150a467cf43e5c309238"
        )
        message = _revert_message(Exception((raw, raw)))
        self.assertIn("0xA75dA0D7DdEa2B5b343bf1b83f9D4474C1c7595C", message)
        self.assertIn("REGISTRAR_ROLE", message)
        self.assertNotIn("0xe2517d3f", message)

    def test_decodes_version_sequence(self):
        raw = "0x2f814e2d" + "0" * 63 + "1" + "0" * 63 + "3"
        message = _revert_message(Exception(raw))
        self.assertIn("espera la versión 1", message)
        self.assertIn("recibió la 3", message)
