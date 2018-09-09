from django.urls import path
from django.views import generic
from . import views

app_name = 'sim'

urlpatterns = [
    path('<str:code>/', views.run, name='run'),
]
