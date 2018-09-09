from django.shortcuts import render


def run(request, code):
    code_file = '/static/code/{}.js'.format(code)
    return render(request, 'sim/run.html', {'code_file':code_file})
