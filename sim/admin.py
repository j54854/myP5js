from django.contrib import admin
from . import models


class StateInline(admin.TabularInline):
    model = models.State
    extra = 0

class GameAdmin(admin.ModelAdmin):
    inlines = [StateInline]

admin.site.register(models.Game, GameAdmin)
