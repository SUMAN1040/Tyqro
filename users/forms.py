from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.forms import AuthenticationForm

class UserSignupForm(forms.ModelForm):
    first_name = forms.CharField(max_length=30, required=True, label='First Name', widget=forms.TextInput(attrs={'class': 'form-control bg-dark text-white border-secondary'}))
    last_name = forms.CharField(max_length=30, required=True, label='Last Name', widget=forms.TextInput(attrs={'class': 'form-control bg-dark text-white border-secondary'}))
    email = forms.EmailField(max_length=254, required=True, label='Email Address', widget=forms.EmailInput(attrs={'class': 'form-control bg-dark text-white border-secondary'}))
    password = forms.CharField(widget=forms.PasswordInput(attrs={'class': 'form-control bg-dark text-white border-secondary'}), label='Password')
    password_confirm = forms.CharField(widget=forms.PasswordInput(attrs={'class': 'form-control bg-dark text-white border-secondary'}), label='Confirm Password')

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email']

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if email:
            email = email.strip().lower()
        existing_user = User.objects.filter(email__iexact=email).first()
        if existing_user:
            if existing_user.is_active:
                raise forms.ValidationError("This email address is already in use.")
            else:
                existing_user.delete()
        return email

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        password_confirm = cleaned_data.get("password_confirm")
        if password and password_confirm and password != password_confirm:
            self.add_error('password_confirm', "Passwords don't match")
            
        if password:
            from django.contrib.auth.password_validation import validate_password
            from django.core.exceptions import ValidationError
            try:
                validate_password(password)
            except ValidationError as e:
                self.add_error('password', e)
        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data["email"].strip().lower()
        user.username = user.email[:150]
        user.set_password(self.cleaned_data["password"])
        user.is_active = False  # Deactivate account till email is verified
        if commit:
            user.save()
        return user

class EmailAuthenticationForm(AuthenticationForm):
    username = forms.EmailField(label="Email Address", widget=forms.EmailInput(attrs={'autofocus': True, 'class': 'form-control bg-dark text-white border-secondary'}))
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['password'].widget.attrs.update({'class': 'form-control bg-dark text-white border-secondary'})
