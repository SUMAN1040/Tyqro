# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_rename_use_standard_schedule_userprofile_use_fixed_schedule_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userprofile',
            name='work_days',
            field=models.CharField(default='Mon,Tue,Wed,Thu,Fri,Sat,Sun', max_length=100),
        ),
    ]
