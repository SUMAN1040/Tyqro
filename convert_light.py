import re

with open('templates/landing.html', 'r') as f:
    content = f.read()

# Insert html_attrs block
content = content.replace("{% extends 'base.html' %}", "{% extends 'base.html' %}\n\n{% block html_attrs %}data-bs-theme=\"light\"{% endblock %}")

# Navbar
content = content.replace('rgba(var(--bs-dark-rgb), 0.85)', 'rgba(255, 255, 255, 0.85)')
content = content.replace('text-white d-flex align-items-center gap-2', 'text-dark d-flex align-items-center gap-2')
content = content.replace('text-white fw-bold px-2', 'text-dark fw-bold px-2')
content = content.replace('text-light text-decoration-none fw-medium', 'text-dark text-decoration-none fw-medium')

# Hero section
content = content.replace('bg-dark bg-opacity-50', 'bg-white shadow-sm')
content = content.replace('text-light fw-medium', 'text-dark fw-medium')
content = content.replace('text-white tracking-tight', 'text-dark tracking-tight')
content = content.replace('btn-outline-light border-opacity-25', 'btn-outline-dark border-opacity-25')

# Mockup UI
content = content.replace('bg-dark border border-secondary', 'bg-white border border-dark')
content = content.replace('bg-black bg-opacity-25', 'bg-light')
content = content.replace('bg-secondary bg-opacity-10', 'bg-dark bg-opacity-10')
content = content.replace('bg-secondary bg-opacity-25', 'bg-dark bg-opacity-25')
content = content.replace('border-secondary border-opacity-10', 'border-dark border-opacity-10')
content = content.replace('border-secondary border-opacity-25', 'border-dark border-opacity-10')
content = content.replace('text-white font-monospace', 'text-dark font-monospace')
content = content.replace('text-white">Write implementation plan', 'text-dark">Write implementation plan')

# Logo Cloud
content = content.replace('bg-dark bg-opacity-25', 'bg-light')
content = content.replace('opacity-50 grayscale', 'opacity-50 grayscale text-dark')

# Features Section
content = content.replace('text-white">Everything you need.', 'text-dark">Everything you need.')
content = content.replace('text-white">Precision Time Tracking', 'text-dark">Precision Time Tracking')
content = content.replace('text-white">Task Management', 'text-dark">Task Management')
content = content.replace('text-white">Performance Analytics', 'text-dark">Performance Analytics')

# How It Works
content = content.replace('text-white">Focus on work, not the tool.', 'text-dark">Focus on work, not the tool.')
content = content.replace('text-white">Start your session', 'text-dark">Start your session')
content = content.replace('text-white">Conquer your day', 'text-dark">Conquer your day')
content = content.replace('p-4 bg-dark', 'p-4 bg-white')

# Benefits Section
content = content.replace('bg-dark bg-opacity-25 border-top', 'bg-white border-top')
content = content.replace('text-white">Why choose Tyqro?', 'text-dark">Why choose Tyqro?')
content = content.replace('bg-black bg-opacity-50', 'bg-light')
content = content.replace('text-white">Built for Speed', 'text-dark">Built for Speed')
content = content.replace('text-white">Privacy First', 'text-dark">Privacy First')
content = content.replace('text-white">Beautiful Design', 'text-dark">Beautiful Design')

# CTA Section
content = content.replace('text-white">Ready to elevate', 'text-dark">Ready to elevate')

# Footer
content = content.replace('text-white">Tyqro.', 'text-dark">Tyqro.')
content = content.replace('hover-white:hover', 'hover-dark:hover')
content = content.replace('text-light text-decoration-none hover-white', 'text-dark text-decoration-none hover-dark')

with open('templates/landing.html', 'w') as f:
    f.write(content)
