"""Access control for paid topic Consultas."""

from content.models import Topic, TopicPurchase


def user_has_topic_consultas_access(user, topic: Topic) -> bool:
    """
    Whether the user may run Consultas on this topic.

    Free topics (no price) are open once chat is enabled. Creator, moderators,
    and staff always have access. Otherwise a PAID TopicPurchase is required.
    """
    if not topic.is_paid_topic:
        return True
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    if getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False):
        return True
    if topic.is_moderator_or_creator(user):
        return True
    return TopicPurchase.objects.filter(
        user=user,
        topic=topic,
        payment_status='PAID',
    ).exists()


def get_user_topic_purchase(user, topic: Topic):
    if user is None or not getattr(user, 'is_authenticated', False):
        return None
    return (
        TopicPurchase.objects.filter(user=user, topic=topic)
        .order_by('-created_at')
        .first()
    )


def get_or_create_topic_purchase(*, topic: Topic, user) -> TopicPurchase:
    if not topic.is_paid_topic:
        raise ValueError('Las consultas de este tema son gratuitas.')
    if topic.is_moderator_or_creator(user) or getattr(user, 'is_staff', False):
        raise ValueError('Ya tienes acceso a las consultas de este tema.')

    purchase, created = TopicPurchase.objects.get_or_create(
        user=user,
        topic=topic,
        defaults={
            'payment_status': 'PENDING',
            'price_amount': float(topic.reference_price),
        },
    )
    if not created and purchase.payment_status != 'PAID':
        price = float(topic.reference_price)
        if purchase.price_amount != price:
            purchase.price_amount = price
            purchase.save(update_fields=['price_amount', 'updated_at'])
    return purchase
