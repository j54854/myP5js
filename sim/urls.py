from django.urls import path
from django.views.generic import TemplateView
from . import views

app_name = 'sim'

urlpatterns = [
    path('', TemplateView.as_view(template_name='sim/index.html'), name='index'),
    path('test/', TemplateView.as_view(template_name='sim/test.html'), name='test'),
    path('get/', views.get_games, name='get_games'),
    path('post/', views.post_logs, name='post_logs'),
]
