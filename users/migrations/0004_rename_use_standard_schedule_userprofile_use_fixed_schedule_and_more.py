# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_userprofile_use_standard_schedule_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='userprofile',
            old_name='use_standard_schedule',
            new_name='use_fixed_schedule',
        ),
        migrations.AlterField(
            model_name='userprofile',
            name='use_fixed_schedule',
            field=models.BooleanField(default=False),
        ),
    ]
