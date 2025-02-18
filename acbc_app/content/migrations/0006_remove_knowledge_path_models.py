from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0005_alter_topic_topic_image'),
        ('knowledge_paths', '0001_initial'),  # Add dependency on knowledge_paths
    ]

    operations = [
        migrations.RemoveField(
            model_name='nodeactivityrequirement',
            name='activity_requirement',
        ),
        migrations.RemoveField(
            model_name='nodeactivityrequirement',
            name='following_node',
        ),
        migrations.RemoveField(
            model_name='nodeactivityrequirement',
            name='preceding_node',
        ),
        migrations.RemoveField(
            model_name='nodeorder',
            name='knowledge_path',
        ),
        migrations.RemoveField(
            model_name='nodeorder',
            name='node',
        ),
        migrations.RemoveField(
            model_name='node',
            name='content',
        ),
        migrations.RemoveField(
            model_name='node',
            name='knowledge_path',
        ),
        migrations.RemoveField(
            model_name='knowledgepath',
            name='author',
        ),
        migrations.RemoveField(
            model_name='activityrequirement',
            name='knowledge_path',
        ),
        migrations.DeleteModel(
            name='ActivityRequirement',
        ),
        migrations.DeleteModel(
            name='KnowledgePath',
        ),
        migrations.DeleteModel(
            name='Node',
        ),
        migrations.DeleteModel(
            name='NodeActivityRequirement',
        ),
        migrations.DeleteModel(
            name='NodeOrder',
        ),
    ] 