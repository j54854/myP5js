import json
from django.shortcuts import render
from django.http import JsonResponse, HttpResponseServerError
from . import models


def get_games(request):
    games = models.Game.objects.all().order_by("-score").values()
    gamelist = list(games)
    return JsonResponse(gamelist, safe=False)


def post_logs(request):
    if request.method == 'POST' and request.body:
        json_dict = json.loads(request.body)
        score = int(json_dict['score'])
        game = models.Game.objects.create(score=score)
        for log in json_dict['logs'].values():
            models.State.objects.create(
                game=game,
                time=float(log['time']),
                vol=int(log['vol']),
                ordered=int(log['ordered']),
                outs=int(log['outs']),
                holding_cost=float(log['hc']),
                ordering_cost=int(log['oc']),
                revenue=int(log['rv']),
            )
        return JsonResponse(json_dict)
    else:
        return HttpResponseServerError()
