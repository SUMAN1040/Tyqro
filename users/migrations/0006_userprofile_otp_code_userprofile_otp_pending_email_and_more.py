# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_alter_userprofile_work_days'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='otp_code',
            field=models.CharField(blank=True, max_length=6, null=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='otp_pending_email',
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='otp_purpose',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
    ]
