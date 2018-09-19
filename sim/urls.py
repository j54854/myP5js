from django.urls import path
from django.views.generic import TemplateView
from . import views

app_name = 'sim'

urlpatterns = [
    path('', TemplateView.as_view(template_name='sim/index.html'), name='index'),
]
