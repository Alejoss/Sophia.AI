from profiles.models import UserNodeCompletion
from knowledge_paths.models import Node, KnowledgePath
from quizzes.models import UserQuizAttempt
from django.utils import timezone
from django.db.models import Count
from utils.notification_utils import notify_knowledge_path_completion


def has_completed_quiz(user, quiz):
    """
    Check if a user has completed a quiz with a perfect score.
    
    Args:
        user: The user to check
        quiz: The quiz to check
        
    Returns:
        bool: True if the user has completed the quiz with a perfect score, False otherwise
    """
    return UserQuizAttempt.objects.filter(
        quiz=quiz,
        user=user,
        score=100
    ).exists()


def is_node_available_for_user(node, user):
    """
    Check if a node is available for a user based on completion of preceding nodes and quizzes,
    or if the user is the creator of the knowledge path.
    
    Args:
        node (Node): The node to check availability for.
        user (User): The user for whom to check availability.
    
    Returns:
        bool: True if the node is available, False otherwise.
    """
    # Check if the user is the creator of the knowledge path
    if node.knowledge_path.author == user:
        return True

    # Get the preceding node
    preceding_node = node.get_preceding_node()

    # If there is no preceding node, assume the current node is the first and is available
    if preceding_node is None:
        return True

    # Check if the preceding node is completed
    if not is_node_completed_by_user(preceding_node, user):
        return False

    # Check if all quizzes for the preceding node are completed
    quizzes = preceding_node.quizzes.all()
    for quiz in quizzes:
        if not has_completed_quiz(user, quiz):
            return False

    return True


def is_node_completed_by_user(node, user):
    """
    Check if a node is completed by a user.
    
    Args:
        node (Node): The node to check completion for.
        user (User): The user for whom to check completion.
    
    Returns:
        bool: True if the node is completed, False otherwise.
    """
    progress = UserNodeCompletion.objects.filter(user=user, knowledge_path=node.knowledge_path, node=node).first()
    if progress and progress.is_completed:
        return True
    return False


def mark_node_as_completed(user, node):
    """
    Mark a node as completed for a user and update the progress in the knowledge path.
    """
    knowledge_path = node.knowledge_path
    last_node = knowledge_path.nodes.order_by('-order').first()

    progress, created = UserNodeCompletion.objects.get_or_create(
        user=user,
        knowledge_path=knowledge_path,
        node=node,
        defaults={'is_completed': True, 'completed_at': timezone.now()}
    )

    if not created and not progress.is_completed:
        progress.is_completed = True
        progress.completed_at = timezone.now()
        progress.save()


def is_knowledge_path_completed(user, knowledge_path):
    """
    Check if a user has completed all nodes and passed all quizzes in a knowledge path.
    If completed, notify the knowledge path author.
    
    Args:
        user: The user to check
        knowledge_path: The KnowledgePath instance to verify
        
    Returns:
        bool: True if the path is completed, False otherwise
    """
    # Get all nodes in the path
    total_nodes = knowledge_path.nodes.count()
    if total_nodes == 0:
        return False
    
    # Get completed nodes
    completed_nodes = UserNodeCompletion.objects.filter(
        user=user,
        knowledge_path=knowledge_path,
        is_completed=True
    ).count()

    # If not all nodes are completed, return False early
    if completed_nodes != total_nodes:
        return False

    # Check all quizzes in the path
    for node in knowledge_path.nodes.all():
        quiz = node.quizzes.first()
        if quiz and not has_completed_quiz(user, quiz):
            return False

    # If we get here, the path is completed
    # Notify the knowledge path author
    print("Notifying knowledge path completion !!!!!!!!!!!!!!!!")
    notify_knowledge_path_completion(user, knowledge_path)
    
    return True


def get_knowledge_path_progress(user, knowledge_path):
    """
    Get detailed progress information for a knowledge path.
    
    Args:
        user: The user to check
        knowledge_path: The KnowledgePath instance to check
        
    Returns:
        dict: Dictionary containing progress information including:
            - total_nodes: Total number of nodes in the path
            - completed_nodes: Number of completed nodes
            - completion_percentage: Percentage of path completed
            - nodes_progress: List of node progress details
            - is_completed: Whether the entire path is completed
    """
    nodes = knowledge_path.nodes.all().order_by('order')
    total_nodes = nodes.count()
    
    # Get all completed nodes for this user and path
    completed_nodes = UserNodeCompletion.objects.filter(
        user=user,
        knowledge_path=knowledge_path,
        is_completed=True
    ).count()

    # Get detailed progress for each node
    nodes_progress = []
    for node in nodes:
        quiz = node.quizzes.first()
        node_data = {
            'node_id': node.id,
            'title': node.title,
            'is_completed': is_node_completed_by_user(node, user),
            'is_available': is_node_available_for_user(node, user),
            'order': node.order
        }
        
        if quiz:
            best_attempt = UserQuizAttempt.objects.filter(
                user=user,
                quiz=quiz
            ).order_by('-score').first()
            
            node_data.update({
                'has_quiz': True,
                'quiz_title': quiz.title,
                'best_score': best_attempt.score if best_attempt else 0,
                'quiz_passed': has_completed_quiz(user, quiz)
            })
        else:
            node_data.update({
                'has_quiz': False,
                'quiz_passed': True  # Nodes without quizzes are considered "passed"
            })
            
        nodes_progress.append(node_data)

    return {
        'total_nodes': total_nodes,
        'completed_nodes': completed_nodes,
        'completion_percentage': (completed_nodes / total_nodes * 100) if total_nodes > 0 else 0,
        'nodes_progress': nodes_progress,
        'is_completed': is_knowledge_path_completed(user, knowledge_path)
    } 