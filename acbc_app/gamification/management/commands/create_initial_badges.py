"""
Management command to create initial badges for the gamification system.

Usage: python manage.py create_initial_badges
"""

from django.core.management.base import BaseCommand
from gamification.models import Badge, BadgeCategory


class Command(BaseCommand):
    help = 'Create initial badges for the gamification system'

    def handle(self, *args, **options):
        badges_data = [
            {
                'code': 'first_knowledge_path_completed',
                'name': 'Iniciación al Conocimiento',
                'description': 'Reconoce el inicio formal del viaje de aprendizaje del usuario dentro de la red de conocimiento compartido.',
                'category': BadgeCategory.LEARNING,
                'points_value': 50,
            },
            {
                'code': 'quiz_master',
                'name': 'Dominio Conceptual',
                'description': 'Reconoce la comprensión precisa y completa de conceptos a través de evaluaciones exitosas.',
                'category': BadgeCategory.LEARNING,
                'points_value': 25,
            },
            {
                'code': 'knowledge_seeker',
                'name': 'Comprensión Progresiva',
                'description': 'Recompensa la consistencia y el aprendizaje sostenido en el tiempo dentro de la comunidad.',
                'category': BadgeCategory.LEARNING,
                'points_value': 35,
            },
            {
                'code': 'first_comment',
                'name': 'Ingreso al Diálogo',
                'description': 'Marca la entrada del usuario al intercambio intelectual y la participación activa en la comunidad.',
                'category': BadgeCategory.CONTRIBUTION,
                'points_value': 10,
            },
            {
                'code': 'first_knowledge_path_created',
                'name': 'Arquitecto de Conocimiento',
                'description': 'Reconoce la capacidad de estructurar y organizar conocimiento para otros en la red compartida.',
                'category': BadgeCategory.CONTRIBUTION,
                'points_value': 60,
            },
            {
                'code': 'content_creator',
                'name': 'Autor Validado',
                'description': 'Señala la creación consistente de contenido con validación y reconocimiento de la comunidad.',
                'category': BadgeCategory.CONTRIBUTION,
                'points_value': 50,
            },
            {
                'code': 'first_highly_rated_comment',
                'name': 'Aporte Relevante',
                'description': 'Recompensa la claridad, rigor y utilidad en el discurso que genera valor para la comunidad.',
                'category': BadgeCategory.RECOGNITION,
                'points_value': 30,
            },
            {
                'code': 'first_highly_rated_content',
                'name': 'Contenido Valioso',
                'description': 'Reconoce contenido que se vuelve significativo y valioso para la comunidad de aprendizaje.',
                'category': BadgeCategory.RECOGNITION,
                'points_value': 40,
            },
            {
                'code': 'community_voice',
                'name': 'Voz Confiable',
                'description': 'Representa la confianza sostenida ganada a través de contribuciones de alta calidad repetidas.',
                'category': BadgeCategory.RECOGNITION,
                'points_value': 45,
            },
            {
                'code': 'topic_curator',
                'name': 'Curador de Conexiones',
                'description': 'Reconoce la creación de un tema que organiza y atrae contenido relevante con validación inicial de la comunidad.',
                'category': BadgeCategory.CONTRIBUTION,
                'points_value': 45,
            },
            {
                'code': 'topic_architect',
                'name': 'Arquitecto de Temas',
                'description': 'Reconoce la creación de un tema que alcanza amplio reconocimiento comunitario y genera valor significativo.',
                'category': BadgeCategory.RECOGNITION,
                'points_value': 65,
            },
        ]

        created_count = 0
        updated_count = 0

        for badge_data in badges_data:
            badge, created = Badge.objects.update_or_create(
                code=badge_data['code'],
                defaults={
                    'name': badge_data['name'],
                    'description': badge_data['description'],
                    'category': badge_data['category'],
                    'points_value': badge_data['points_value'],
                    'is_active': True,
                }
            )

            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created badge: {badge.name} ({badge.code})')
                )
            else:
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(f'Updated badge: {badge.name} ({badge.code})')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'\nBadge creation completed. Created: {created_count}, Updated: {updated_count}'
            )
        )