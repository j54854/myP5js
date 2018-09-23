from django.db import models

# ---------- ---------- ----------
class Game(models.Model):
# ---------- ---------- ----------
    score = models.IntegerField(default=0)
# ---------- ---------- ----------
    def __str__(self):
        return u"game_{}".format(self.pk)

# ---------- ---------- ----------
class State(models.Model):
# ---------- ---------- ----------
    game = models.ForeignKey(Game, on_delete=models.CASCADE)
    time = models.FloatField()
    vol = models.IntegerField()
    ordered = models.IntegerField()
    outs = models.IntegerField()
    holding_cost = models.FloatField()
    ordering_cost = models.IntegerField()
    revenue = models.IntegerField()
# ---------- ---------- ----------
    def __str__(self):
        return u"state_{}_{}".format(self.game.pk, self.pk)

    
