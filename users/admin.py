from django.contrib import admin
from .models import UserProfile, StudyGroup, StudyGroupMembership, PeerConnection

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'study_code', 'daily_hours_target', 'use_fixed_schedule', 'work_start_time', 'work_end_time')
    search_fields = ('user__username', 'user__email', 'study_code')
    list_filter = ('use_fixed_schedule',)

@admin.register(PeerConnection)
class PeerConnectionAdmin(admin.ModelAdmin):
    list_display = ('user', 'peer', 'created_at')
    search_fields = ('user__username', 'peer__username')
    list_filter = ('created_at',)

@admin.register(StudyGroup)
class StudyGroupAdmin(admin.ModelAdmin):
    list_display = ('code', 'creator', 'created_at')
    search_fields = ('code', 'creator__username')

@admin.register(StudyGroupMembership)
class StudyGroupMembershipAdmin(admin.ModelAdmin):
    list_display = ('group', 'user', 'joined_at')
    search_fields = ('group__code', 'user__username')