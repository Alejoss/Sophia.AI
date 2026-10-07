import logging

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from certificates.ethereum_client import EthereumRegistryClient, EthereumRegistryError
from certificates.models import Certificate
from certificates.services.ethereum_credentials import (
    dashboard,
    latest_snapshot,
    mint_credential,
    mint_reward,
    register_version,
    reward_image_url,
    reward_metadata,
)
from certificates.services.ethereum_jobs import (
    begin_mint,
    begin_register,
    begin_reward,
    jobs_run_inline,
)

logger = logging.getLogger(__name__)


def get_registry_client():
    return EthereumRegistryClient.from_env()


def _reject(action, exc):
    logger.warning("Sepolia rechazó %s: %s", action, exc)
    return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


def _respond(action, inline, enqueue):
    """Run the chain write in this request during tests. Otherwise return immediately."""
    if jobs_run_inline():
        try:
            payload = inline()
        except EthereumRegistryError as exc:
            return _reject(action, exc)
        return Response(payload)
    try:
        payload = enqueue()
    except EthereumRegistryError as exc:
        return _reject(action, exc)
    if payload.get("pending"):
        logger.info("Sepolia aceptó %s y la confirmación sigue en segundo plano", action)
        return Response(payload, status=status.HTTP_202_ACCEPTED)
    return Response(payload)


class EthereumCredentialDashboardView(APIView):
    """Staff: read the Sepolia registry and the platform certificates it can receive."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        try:
            payload = dashboard(get_registry_client(), request)
        except EthereumRegistryError as exc:
            return _reject("lectura del contrato", exc)
        return Response(payload)


class EthereumCredentialRegisterView(APIView):
    """Staff: register the latest stored snapshot version on the credential registry."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, certificate_pk):
        certificate = get_object_or_404(
            Certificate.objects.select_related("knowledge_path", "user"),
            pk=certificate_pk,
            knowledge_path__isnull=False,
        )
        snapshot_uri = request.build_absolute_uri(
            f"/api/knowledge_paths/{certificate.knowledge_path_id}/snapshots/"
        )
        snapshot = latest_snapshot(certificate)
        if snapshot is not None:
            snapshot_uri = request.build_absolute_uri(
                f"/api/knowledge_paths/{certificate.knowledge_path_id}/snapshots/{snapshot.version}/"
            )
        action = f"registrar versión certificate={certificate.pk}"
        return _respond(
            action,
            lambda: register_version(certificate, get_registry_client(), snapshot_uri),
            lambda: begin_register(certificate, snapshot_uri, get_registry_client),
        )


class EthereumCredentialMintView(APIView):
    """Staff: mint the soulbound credential directly to a recipient address."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, certificate_pk):
        certificate = get_object_or_404(
            Certificate.objects.select_related("knowledge_path", "user"),
            pk=certificate_pk,
            knowledge_path__isnull=False,
        )
        recipient = request.data.get("recipient") or ""
        credential_uri = request.build_absolute_uri(
            f"/api/certificates/ethereum/artifact/{certificate.certificate_id}/"
        )
        action = f"emitir certificado certificate={certificate.pk}"
        return _respond(
            action,
            lambda: mint_credential(certificate, recipient, get_registry_client(), credential_uri),
            lambda: begin_mint(certificate, recipient, credential_uri, get_registry_client),
        )


class EthereumRewardMintView(APIView):
    """Staff: mint the transferable completion reward to a recipient address."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, certificate_pk):
        certificate = get_object_or_404(
            Certificate.objects.select_related("knowledge_path", "user"),
            pk=certificate_pk,
            knowledge_path__isnull=False,
        )
        recipient = request.data.get("recipient") or ""
        reward_uri = request.build_absolute_uri(
            f"/api/certificates/ethereum/reward/{certificate.certificate_id}/"
        )
        action = f"emitir NFT certificate={certificate.pk}"
        return _respond(
            action,
            lambda: mint_reward(certificate, recipient, get_registry_client(), reward_uri),
            lambda: begin_reward(certificate, recipient, reward_uri, get_registry_client),
        )


class EthereumRewardImageView(APIView):
    """Staff: store the completion-reward image on the certificate."""

    permission_classes = [IsAuthenticated, IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]
    allowed_types = {"image/png", "image/jpeg", "image/webp"}
    max_bytes = 5 * 1024 * 1024

    def post(self, request, certificate_pk):
        certificate = get_object_or_404(
            Certificate.objects.select_related("knowledge_path", "user"),
            pk=certificate_pk,
            knowledge_path__isnull=False,
        )
        upload = request.FILES.get("image")
        image_uri = (request.data.get("image_uri") or "").strip()
        if upload is None and not image_uri:
            return Response(
                {"error": "Elige una imagen para el NFT."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if upload is not None:
            content_type = getattr(upload, "content_type", "") or ""
            if content_type not in self.allowed_types:
                return Response(
                    {"error": "La imagen debe ser PNG, JPEG o WebP."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if upload.size > self.max_bytes:
                return Response(
                    {"error": "La imagen debe pesar 5 MB o menos."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if certificate.reward_image:
                certificate.reward_image.delete(save=False)
            certificate.reward_image = upload
        if image_uri:
            if not (image_uri.startswith("ipfs://") or image_uri.startswith("https://")):
                return Response(
                    {"error": "El URI de la imagen debe empezar por ipfs:// o https://."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            certificate.reward_image_uri = image_uri
        certificate.save()
        return Response({
            "rewardImage": reward_image_url(certificate, request),
            "rewardImageUri": certificate.reward_image_uri,
        })


class RewardMetadataView(APIView):
    """Public metadata for a transferable completion reward."""

    permission_classes = [AllowAny]

    def get(self, request, certificate_id):
        certificate = get_object_or_404(
            Certificate.objects.select_related("knowledge_path", "user"),
            certificate_id=certificate_id,
            knowledge_path__isnull=False,
        )
        return Response(reward_metadata(certificate, request))


class CredentialArtifactView(APIView):
    """Return the frozen credential JSON stored before mint."""

    permission_classes = [AllowAny]

    def get(self, request, certificate_id):
        certificate = get_object_or_404(Certificate, certificate_id=certificate_id)
        if not certificate.credential_canonical:
            return Response(
                {"error": "Este certificado todavía no tiene un artefacto."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return HttpResponse(
            certificate.credential_canonical,
            content_type="application/json; charset=utf-8",
        )
