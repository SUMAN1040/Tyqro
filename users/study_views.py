from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import UserProfile, StudyGroup, StudyGroupMembership
from attendance.models import Attendance
from attendance.views import auto_close_previous_sessions
from todos.models import Todo

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def get_study_code(request):
    """
    Get or create the user's lifetime study code and ensure their host StudyGroup exists.
    """
    profile = request.user.profile
    code = profile.get_or_create_study_code()
    
    # Ensure creator has a StudyGroup with this code
    group, _ = StudyGroup.objects.get_or_create(creator=request.user, defaults={'code': code})
    if group.code != code:
        group.code = code
        group.save(update_fields=['code'])
        
    # Ensure user is in their own group membership if not in any other group
    has_membership = StudyGroupMembership.objects.filter(user=request.user).exists()
    if not has_membership:
        StudyGroupMembership.objects.get_or_create(group=group, user=request.user)

    return Response({
        'status': 'success',
        'study_code': code,
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def join_study_group(request):
    """
    Join a study group using a shared lifetime study code. Up to 10 members allowed.
    """
    code = request.data.get('code', '').strip().upper()
    if not code:
        return Response({'error': 'Please enter a valid study code.'}, status=status.HTTP_400_BAD_REQUEST)

    # Find the user or group with this code
    target_profile = UserProfile.objects.filter(study_code=code).select_related('user').first()
    if not target_profile:
        return Response({'error': 'Invalid study code. No study group found.'}, status=status.HTTP_404_NOT_FOUND)

    owner = target_profile.user
    group, _ = StudyGroup.objects.get_or_create(creator=owner, defaults={'code': code})
    
    # Check max limit of 10 members
    current_count = group.memberships.count()
    is_already_member = group.memberships.filter(user=request.user).exists()
    
    if not is_already_member and current_count >= 10:
        return Response({'error': 'This study group is full (maximum 10 members allowed).'}, status=status.HTTP_400_BAD_REQUEST)

    # Remove user from any other group first
    StudyGroupMembership.objects.filter(user=request.user).exclude(group=group).delete()
    
    # Also ensure the owner is added to memberships
    StudyGroupMembership.objects.get_or_create(group=group, user=owner)

    # Add current user
    StudyGroupMembership.objects.get_or_create(group=group, user=request.user)

    return Response({
        'status': 'success',
        'message': f'Successfully joined {owner.first_name or owner.username}\'s study group!',
        'group_code': code
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_group_status(request):
    """
    Get current user's active study group and all member details (up to 10).
    """
    membership = StudyGroupMembership.objects.filter(user=request.user).select_related('group', 'group__creator').first()
    
    if not membership:
        return Response({
            'in_group': False,
            'members': [],
            'count': 0,
            'max_members': 10
        })

    group = membership.group
    memberships = group.memberships.select_related('user', 'user__profile').all().order_by('joined_at')
    
    today = timezone.now().date()
    members_data = []

    for m in memberships:
        u = m.user
        p = getattr(u, 'profile', None)
        avatar_url = None
        if p and p.avatar:
            try:
                avatar_url = p.avatar.url
            except Exception:
                avatar_url = None
        
        # Check today's attendance status
        att = Attendance.objects.filter(user=u, date=today).first()
        is_active = bool(att and att.is_active)
        is_break = bool(att and att.current_break_start)
        has_ended = bool(att and att.end_time and not is_active)

        # Todo counts
        todos_qs = Todo.objects.filter(user=u, date=today)
        total_todos = todos_qs.count()
        completed_todos = todos_qs.filter(is_completed=True).count()

        members_data.append({
            'id': u.id,
            'username': u.username,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'full_name': f"{u.first_name} {u.last_name}".strip() or u.username,
            'avatar_url': avatar_url,
            'is_creator': (u.id == group.creator_id),
            'is_self': (u.id == request.user.id),
            'is_active': is_active,
            'is_break': is_break,
            'has_ended': has_ended,
            'total_todos': total_todos,
            'completed_todos': completed_todos,
            'joined_at': m.joined_at.isoformat(),
        })

    return Response({
        'in_group': True,
        'group_code': group.code,
        'is_creator': (request.user.id == group.creator_id),
        'creator_name': group.creator.get_full_name() or group.creator.username,
        'members': members_data,
        'count': len(members_data),
        'max_members': 10,
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def leave_study_group(request):
    """
    Leave current study group.
    """
    membership = StudyGroupMembership.objects.filter(user=request.user).first()
    if membership:
        membership.delete()
        
    return Response({'status': 'success', 'message': 'Left study group successfully.'})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_group_member(request):
    """
    Remove a member from the study group (creator only or self).
    """
    target_user_id = request.data.get('user_id')
    if not target_user_id:
        return Response({'error': 'User ID required.'}, status=status.HTTP_400_BAD_REQUEST)

    membership = StudyGroupMembership.objects.filter(user=request.user).select_related('group').first()
    if not membership:
        return Response({'error': 'You are not in a group.'}, status=status.HTTP_400_BAD_REQUEST)

    group = membership.group
    # Check permissions
    if group.creator_id != request.user.id and int(target_user_id) != request.user.id:
        return Response({'error': 'Only group host can remove other members.'}, status=status.HTTP_403_FORBIDDEN)

    target_membership = StudyGroupMembership.objects.filter(group=group, user_id=target_user_id).first()
    if target_membership:
        target_membership.delete()

    return Response({'status': 'success', 'message': 'Member removed.'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_peer_data(request, peer_id):
    """
    Fetch specified peer's live work attendance and todo list for today.
    Read-only view for group study.
    """
    # Verify both users are in the same active group
    user_group_ids = set(StudyGroupMembership.objects.filter(user=request.user).values_list('group_id', flat=True))
    peer_group_ids = set(StudyGroupMembership.objects.filter(user_id=peer_id).values_list('group_id', flat=True))
    
    # Allow self or shared group
    if request.user.id != int(peer_id) and not (user_group_ids & peer_group_ids):
        return Response({'error': 'You do not share a study group with this member.'}, status=status.HTTP_403_FORBIDDEN)

    peer_user = get_object_or_404(User, id=peer_id)
    auto_close_previous_sessions(peer_user)
    today = timezone.now().date()
    now = timezone.now()

    att = Attendance.objects.filter(user=peer_user, date=today).first()
    todos = Todo.objects.filter(user=peer_user, date=today).order_by('created_at')

    # Avatar URL
    p = getattr(peer_user, 'profile', None)
    avatar_url = None
    if p and p.avatar:
        try:
            avatar_url = p.avatar.url
        except Exception:
            avatar_url = None

    # Attendance calculation
    total_break_seconds = 0
    current_break_start_iso = None
    is_break = False
    is_active = False
    start_time_iso = None
    end_time_iso = None
    total_seconds = 0
    net_seconds = 0
    has_ended = False

    if att:
        is_active = bool(att.is_active)
        is_break = bool(att.current_break_start)
        start_time_iso = att.start_time.isoformat() if att.start_time else None
        end_time_iso = att.end_time.isoformat() if att.end_time else None
        total_break_seconds = att.total_break_duration.total_seconds()
        current_break_start_iso = att.current_break_start.isoformat() if att.current_break_start else None
        has_ended = bool(att.end_time and not is_active)

        if is_active and att.start_time:
            active_break = (now - att.current_break_start).total_seconds() if is_break and att.current_break_start else 0
            accum_break = total_break_seconds + active_break
            elapsed = max(0, (now - att.start_time).total_seconds())
            total_seconds = elapsed
            net_seconds = max(0, elapsed - accum_break)
        elif att.duration:
            net_seconds = att.duration.total_seconds()
            total_seconds = net_seconds + total_break_seconds

    serialized_todos = [{
        'id': t.id,
        'title': t.title,
        'is_completed': t.is_completed,
        'created_at': t.created_at.isoformat()
    } for t in todos]

    return Response({
        'user': {
            'id': peer_user.id,
            'username': peer_user.username,
            'first_name': peer_user.first_name,
            'last_name': peer_user.last_name,
            'full_name': f"{peer_user.first_name} {peer_user.last_name}".strip() or peer_user.username,
            'avatar_url': avatar_url,
            'daily_target': float(p.daily_hours_target) if p else 9.0,
        },
        'attendance': {
            'is_active': is_active,
            'is_break': is_break,
            'has_ended': has_ended,
            'start_time': start_time_iso,
            'end_time': end_time_iso,
            'total_break_seconds': total_break_seconds,
            'current_break_start': current_break_start_iso,
            'total_seconds': total_seconds,
            'net_seconds': net_seconds,
        },
        'todos': serialized_todos,
        'todos_total': len(todos),
        'todos_completed': len([t for t in todos if t.is_completed]),
    })
