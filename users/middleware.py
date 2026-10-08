from django.contrib.auth import logout

class SessionBindingMiddleware:
    """
    Middleware that binds a user's session to their initial IP address
    and User-Agent for session-based web views.
    Excludes stateless API endpoints (/api/) that use JWT tokens.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Skip stateless API endpoints that use JWT authentication
        if request.path.startswith('/api/'):
            return self.get_response(request)

        if hasattr(request, 'user') and request.user.is_authenticated and hasattr(request, 'session') and request.session.session_key:
            # Extract IP address, supporting standard reverse proxies
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0].strip()
            else:
                ip = request.META.get('REMOTE_ADDR')
            
            # Extract User-Agent
            user_agent = request.META.get('HTTP_USER_AGENT', '')

            bound_ip = request.session.get('bound_ip')
            bound_user_agent = request.session.get('bound_user_agent')

            # Bind to session if not already bound
            if not bound_ip or not bound_user_agent:
                request.session['bound_ip'] = ip
                request.session['bound_user_agent'] = user_agent
            else:
                # Enforce matching for active session cookies
                if bound_ip != ip or bound_user_agent != user_agent:
                    logout(request)
        
        response = self.get_response(request)
        return response