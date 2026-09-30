from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import UserProfile, PeerConnection
from attendance.models import Attendance
from attendance.views import auto_close_previous_sessions
from todos.models import Todo

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def get_study_code(request):
    """
    Get or create the user's permanent lifetime study code.
    """
    profile = request.user.profile
    code = profile.get_or_create_study_code()

    return Response({
        'status': 'success',
        'study_code': code,
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def join_study_group(request):
    """
    Connect with a peer using their permanent study code. Can connect up to 10 people.
    """
    code = request.data.get('code', '').strip().upper()
    if not code:
        return Response({'error': 'Please enter a valid study code.'}, status=status.HTTP_400_BAD_REQUEST)

    # Find the user with this code
    target_profile = UserProfile.objects.filter(study_code=code).select_related('user').first()
    if not target_profile:
        return Response({'error': 'Invalid study code. No user found with this code.'}, status=status.HTTP_404_NOT_FOUND)

    target_user = target_profile.user
    if target_user.id == request.user.id:
        return Response({'error': 'You cannot connect with your own code.'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if already connected
    if PeerConnection.objects.filter(user=request.user, peer=target_user).exists():
        return Response({'error': f'You are already connected with {target_user.first_name or target_user.username}.'}, status=status.HTTP_400_BAD_REQUEST)

    # Check maximum limit of 10 peers
    current_count = PeerConnection.objects.filter(user=request.user).count()
    if current_count >= 10:
        return Response({'error': 'You have reached the maximum limit of 10 connected people. Please remove someone to add a new person.'}, status=status.HTTP_400_BAD_REQUEST)

    # Create connection
    PeerConnection.objects.create(user=request.user, peer=target_user)

    target_name = f"{target_user.first_name} {target_user.last_name}".strip() or target_user.username

    return Response({
        'status': 'success',
        'message': f'Successfully connected with {target_name}!',
        'peer_id': target_user.id
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def get_group_status(request):
    """
    Get current user's connected peers and live activity status (up to 10).
    """
    connections = PeerConnection.objects.filter(user=request.user).select_related('peer', 'peer__profile').order_by('-created_at')
    
    today = timezone.now().date()
    peers_data = []

    for conn in connections:
        u = conn.peer
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

        peers_data.append({
            'id': u.id,
            'username': u.username,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'full_name': f"{u.first_name} {u.last_name}".strip() or u.username,
            'avatar_url': avatar_url,
            'is_self': False,
            'is_active': is_active,
            'is_break': is_break,
            'has_ended': has_ended,
            'total_todos': total_todos,
            'completed_todos': completed_todos,
            'connected_at': conn.created_at.isoformat(),
        })

    my_code = request.user.profile.get_or_create_study_code()

    return Response({
        'in_group': bool(len(peers_data) > 0),
        'connected_count': len(peers_data),
        'count': len(peers_data),
        'max_members': 10,
        'members': peers_data,
        'peers': peers_data,
        'my_code': my_code
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def leave_study_group(request):
    """
    Remove all connected peers.
    """
    PeerConnection.objects.filter(user=request.user).delete()
    return Response({'status': 'success', 'message': 'All connected peers removed.'})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_group_member(request):
    """
    Remove a specific person from the user's connected list.
    """
    target_user_id = request.data.get('user_id') or request.data.get('peer_id')
    if not target_user_id:
        return Response({'error': 'User ID required.'}, status=status.HTTP_400_BAD_REQUEST)

    deleted_count, _ = PeerConnection.objects.filter(user=request.user, peer_id=target_user_id).delete()
    if deleted_count > 0:
        return Response({'status': 'success', 'message': 'Person removed from connected list.'})
    else:
        return Response({'error': 'Person not found in your connected list.'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def get_peer_data(request, peer_id):
    """
    Fetch specified peer's live work attendance and todo list for today.
    Read-only view for group study.
    """
    # Verify user is connected with this peer (or self)
    is_connected = PeerConnection.objects.filter(user=request.user, peer_id=peer_id).exists() or (request.user.id == int(peer_id))
    
    if not is_connected:
        return Response({'error': 'You are not connected with this person.'}, status=status.HTTP_403_FORBIDDEN)

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
