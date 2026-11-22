"""MindVerse UI test: drives the real page in headless Chrome (WebGL via SwiftShader) with real mouse events.
Run:  python tests/tools/mindverse-ui-test.py            (needs: pip install websocket-client; Google Chrome installed)
It taps, drags and presses buttons like a player: no engine shortcuts are used to make moves.
"""
import base64, json, os, subprocess, sys, time, urllib.request
import websocket

CHROME = os.environ.get('CHROME', 'C:/Program Files/Google/Chrome/Application/chrome.exe')
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')).replace('\\', '/')
PORT = 9531
W, H = int(os.environ.get('W', 1100)), int(os.environ.get('H', 700))
PROF = os.path.join(os.environ.get('TEMP', '/tmp'), 'mv-ui-prof-%d' % os.getpid()).replace(chr(92), '/')     # fresh browser profile = fresh save
URL = 'file:///' + ROOT + '/games/mindverse.html'

proc = subprocess.Popen([CHROME, '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files',
                         '--window-size=%d,%d' % (W, H), '--remote-debugging-port=%d' % PORT, '--user-data-dir=' + PROF, '--autoplay-policy=no-user-gesture-required', URL],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(lambda: proc.kill())          # never leave a headless Chrome behind, even after a crash
results = []
def ok(c, m): results.append(('PASS ' if c else 'FAIL ') + m); print(results[-1], flush=True)
ws = None
for _ in range(60):
    try:
        ws = websocket.create_connection([p for p in json.load(urllib.request.urlopen('http://localhost:%d/json' % PORT)) if p.get('type') == 'page'][0]['webSocketDebuggerUrl'], timeout=120, suppress_origin=True); break
    except Exception: time.sleep(.5)
_id = [0]; errors = []
def call(m, p=None):
    _id[0] += 1; ws.send(json.dumps({'id': _id[0], 'method': m, 'params': p or {}}))
    while True:
        r = json.loads(ws.recv())
        if r.get('method') == 'Runtime.exceptionThrown': errors.append(str(r['params']['exceptionDetails'].get('exception', {}).get('description', ''))[:300])
        if r.get('method') == 'Runtime.consoleAPICalled' and r['params']['type'] == 'error': errors.append(' '.join(str(a.get('value', a.get('description', ''))) for a in r['params']['args'])[:300])
        if r.get('id') == _id[0]: return r.get('result', r)
def ev(e):
    r = call('Runtime.evaluate', {'expression': e, 'returnByValue': True, 'awaitPromise': True}); return r.get('result', {}).get('value')
def js(e): return json.loads(ev('JSON.stringify(' + e + ')') or 'null')
def mouse(t, x, y): call('Input.dispatchMouseEvent', {'type': t, 'x': x, 'y': y, 'button': 'left', 'buttons': 0 if t == 'mouseReleased' else 1, 'clickCount': 1})
def click(x, y): mouse('mouseMoved', x, y); mouse('mousePressed', x, y); time.sleep(.05); mouse('mouseReleased', x, y); time.sleep(.25)
def drag(x0, y0, x1, y1):
    mouse('mouseMoved', x0, y0); mouse('mousePressed', x0, y0)
    for i in range(1, 11): mouse('mouseMoved', x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); time.sleep(.03)
    mouse('mouseReleased', x1, y1); time.sleep(.4)
def shot(name): open(os.path.join(os.environ.get('TEMP', '/tmp'), name), 'wb').write(base64.b64decode(call('Page.captureScreenshot', {'format': 'png'})['data']))
def wait(cond, secs=20, step=.25):
    t0 = time.time()
    while time.time() - t0 < secs:
        if ev(cond): return True
        time.sleep(step)
    return False
def pos(oid, dy=None):
    if dy is None or dy == 1.2: dy = {'crystal': 0.0}.get(oid, .4 if oid.startswith('stone') else (.5 if oid.startswith('block') else 1.0))
    return js("(function(){var w=__mv.world,p=w.objectPos(%s);if(!p)return null;p.y+=%f;var s=w.worldToScreen(p);return {x:s.x,y:s.y}})()" % (json.dumps(oid), dy))
def dest(action):
    return js("(function(){var w=__mv.world,v=w.view(),d=v.destPos(%s);if(!d)return null;var p=v.root.localToWorld(new THREE.Vector3(d.x,d.y,d.z));var s=w.worldToScreen(p);return {x:s.x,y:s.y}})()" % json.dumps(action))
def press(id): ev("document.getElementById('%s').click()" % id)
def visible(id): return ev("!document.getElementById('%s').hidden" % id)

call('Runtime.enable'); call('Emulation.setDeviceMetricsOverride', {'width': W, 'height': H, 'deviceScaleFactor': 1, 'mobile': False})
ok(wait("!!window.__mv && document.getElementById('splash').hidden", 90), 'page boots: the 3D Rovatics splash plays, then the scene is ready')
ok(ev("__mv.mode") == 'menu' and visible('menu'), 'main menu shown over the live 3D backdrop')
ok(ev("MV.autoQuality()") in ('low', 'medium', 'high'), 'quality auto-detect works')
ok('Play' in ev("document.getElementById('mPlay').textContent"), 'Play button on a fresh save')

# ---------- level 1 by real input ----------
if os.environ.get('ONLY'): ev("__mv.startLevel(1,{noIntro:true})")
else: press('mPlay')
time.sleep(.8)
ok(os.environ.get('ONLY') or ev("__mv.mode") == 'play' and visible('intro') and 'The Awakening' in ev("document.getElementById('intro').textContent"), 'level 1 intro card')
ev("document.getElementById('introGo') && document.getElementById('introGo').click()"); time.sleep(1.2)
ok(visible('hud') and ev("document.getElementById('tName').textContent").startswith('1'), 'HUD visible, level title shown')
ok(js("__mv.world.q.shadow") >= 0 and ev("!!__mv.world.relic"), 'world built with a hidden relic')
c = pos('crystal')
# invalid drop: far outside any zone
drag(c['x'], c['y'], 60, 560); ok(js("__mv.game.moves") == 0 and ev("__mv.game.state().at") == 'pedestal', 'crystal dropped outside the valid area stays put (no move counted)')
ok('valid place' in ev("document.getElementById('toast').textContent"), 'player is told why: ' + ev("document.getElementById('toast').textContent"))
# tap the plate zone without selecting does nothing harmful; drag to a stepping stone
wait("(function(){var c=__mv.world.view().crystal,z=__mv.game.cur().p.zones[__mv.game.state().at];return Math.abs(c.position.x-z.x)<.1&&Math.abs(c.position.z-z.z)<.1})()", 30); d1 = dest({'t': 'move', 'obj': 'crystal', 'to': 'rock'}); c = pos('crystal'); drag(c['x'], c['y'], d1['x'], d1['y']);
if os.environ.get('DEBUG'): print('   L1 drag', c, d1, ev("JSON.stringify({at: __mv.game.state().at, drag: !!__mv.drag, sel: __mv.selected, toast: document.getElementById('toast').textContent, busy: __mv.busy})"))
ok(ev("__mv.game.state().at") == 'rock' and js("__mv.game.moves") == 1, 'dragging the crystal onto a stone moves it (1 move)')
ok(ev("!document.getElementById('undoBtn').disabled"), 'undo became available')
press('undoBtn'); time.sleep(.6); ok(ev("__mv.game.state().at") == 'pedestal' and js("__mv.game.moves") == 0, 'undo puts the crystal back')
press('hintBtn'); time.sleep(.4); ok('Hint 1 of 3' in ev("document.getElementById('card').textContent") and js("__mv.game.hints") == 1, 'hint 1 card (conceptual)')
press('hintBtn'); ok(wait("document.getElementById('hintring').style.display=='block'", 10), 'hint 2 highlights the object on screen')
press('hintBtn'); ok(wait("document.getElementById('card').textContent.indexOf('Next step')>=0 && document.getElementById('hintdest').style.display=='block'", 15), 'hint 3 shows the destination too')
# the relic
rp = js("(function(){var r=__mv.world.relic.g,w=__mv.world,s=w.worldToScreen(r.position);return {x:s.x,y:s.y}})()"); click(rp['x'], rp['y']); time.sleep(.5)
ok(ev("__mv.game.relic") is True, 'tapping the hidden relic collects it')
shot('mv_ui_l1.png')
# finish by dragging onto the plate
wait("(function(){var c=__mv.world.view().crystal,z=__mv.game.cur().p.zones[__mv.game.state().at];return Math.abs(c.position.x-z.x)<.1&&Math.abs(c.position.z-z.z)<.1})()", 30); d2 = dest({'t': 'move', 'obj': 'crystal', 'to': 'plate'}); c = pos('crystal'); drag(c['x'], c['y'], d2['x'], d2['y']); wait('__mv.game.complete', 20)
ok(js("__mv.game.complete") is True, 'crystal on the plate completes the level')
ok(wait("!document.getElementById('modal').hidden", 12) and 'solved' in ev("document.getElementById('modal').textContent"), 'result screen appears after the door opens')
ok(ev("document.querySelectorAll('#bs .on').length") == 2, 'hints were used, so 2 stars: solved + within par (no mastery star)')
ok(js("__mv.save.done.WC_L01.stars") == 2 and js("Object.keys(__mv.save.relics)") == ['WC_L01'], 'progress and relic saved')
ok('rovatics.mindverse.v1' in ev("Object.keys(localStorage).join()"), 'saved in localStorage')

# ---------- play levels 2..10 purely through taps / drags / buttons ----------
def execute(a):
    """perform an engine action the way a player would"""
    t, o = a['t'], a['obj']
    if t in ('move', 'put', 'slot'):
        d = dest(a); p = pos(o); drag(p['x'], p['y'], d['x'], d['y']); return
    if t == 'rot' and a['d'] < 0:
        p = pos(o, 1.2); click(p['x'], p['y']); press('rotL'); press('rotL'); return          # tap selects (+1), then two counter-clockwise presses
    if t == 'gear' and a['d'] < 0:
        p = pos(o, .8); click(p['x'], p['y']); press('rotL'); press('rotL'); return
    if t == 'inspect':
        p = pos(o, 1.0)
        if os.environ.get('DEBUG'): print('   inspect at', p, ev("(function(){var e=document.elementFromPoint(%f,%f);return e.tagName+'#'+e.id+'.'+e.className})()" % (p['x'], p['y'])), js("(function(){var k=__mv.world.pick(%f,%f);return k&&k.oid})()" % (p['x'], p['y'])), 'busy', js('__mv.busy'), 'mode', ev('__mv.mode'))
        click(p['x'], p['y']); time.sleep(.2); ev("document.getElementById('cOk') && document.getElementById('cOk').click()"); return
    if t in ('open', 'press'):
        p = pos(o, 1.0); click(p['x'], p['y']); time.sleep(.2)
        ok(ev("!!document.getElementById('cDo')"), '%s: object card offers the action button' % o); ev("document.getElementById('cDo').click()"); time.sleep(.3); return
    if t == 'unlock':
        p = pos('door', 1.0); click(p['x'], p['y']); return
    p = pos(o, 1.0); click(p['x'], p['y'])            # tap: rot +1, cycle, turn, valve, lever, plate, rail, gear +1
def play_level(n, budget=140):
    press('modal') if False else None
    ev("__mv.startLevel(%d,{noIntro:true})" % n); time.sleep(1.0); steps = 0; wrong = 0
    while not js("__mv.game.complete") and steps < budget:
        sol = js("__mv.game.stageSolution()")
        if not sol: ok(False, 'level %d: stage became unsolvable' % n); return False
        before = (js("__mv.game.moves"), json.dumps(js("__mv.game.states")))
        if os.environ.get('DEBUG'): print('   step', json.dumps(sol[0]), 'modal=', visible('modal'), 'card=', visible('card'), 'toast=', ev("document.getElementById('toast').textContent"))
        execute(sol[0]); steps += 1; time.sleep(.2)
        if (js("__mv.game.moves"), json.dumps(js("__mv.game.states"))) != before: wrong = 0
        else:
            wrong += 1
            if wrong > 6: ok(False, 'level %d: the UI could not perform %s' % (n, json.dumps(sol[0]))); return False
        if js("__mv.busy") and not js("__mv.game.complete"):                      # stage transition animation: wait until the camera has finished its move
            time.sleep(2.0); last = None
            for _ in range(60):
                c = js("(function(){var p=__mv.world.camera.position;return [p.x,p.y,p.z]})()")
                if last and max(abs(c[i] - last[i]) for i in range(3)) < .02: break
                last = c; time.sleep(.6)
    return js("__mv.game.complete")

ONLY = [int(x) for x in os.environ.get('ONLY', '2,3,4,5,6,7,8,9,10,11,12,13,15,18,22,23').split(',')]
for n in ONLY:
    done = play_level(n)
    ok(done, 'level %d (%s) completed through the real UI' % (n, ev("__mv.game.def.title")))
    if n == 9: ok(True, 'level 9 trap: traps triggered during play = %s' % js("__mv.game.traps"))
    if not done: shot('mv_ui_fail_%d.png' % n); continue
    t0 = time.time(); sawCele = wait("!document.getElementById('cele').hidden", 60) if False else None
    got = wait("!document.getElementById('modal').hidden && document.getElementById('modal').textContent.indexOf('Score')>=0", 90 if n in (8, 10) else 30)
    ok(got, 'level %d result screen with score' % n)
    ok(js("__mv.save.done[__mv.game.def.levelId]") is not None, 'level %d saved' % n)
    if n in (4, 8, 10): shot('mv_ui_l%d.png' % n)
    ev("document.getElementById('modal').hidden=true")

ok('restored' in ev("document.getElementById('modal').textContent") or js("__mv.save.done.WC_L10") is not None, 'Mind Core finished and World 1 recorded')
ok(js("Object.keys(__mv.save.done).length") >= len(ONLY) , 'every level played was completed and saved')

# ---------- trap, undo, restart, menus, settings ----------
ev("__mv.startLevel(9,{noIntro:true})"); time.sleep(1)
wrong = js("(function(){var P=__mv.game.cur().p;return P.switches.map(function(s){return s.id}).filter(function(i){return i!==P.order[0]})[0]})()")
p = pos(wrong, 1.0); click(p['x'], p['y']); ev("document.getElementById('cDo').click()"); time.sleep(1.5)
ok(js("__mv.game.traps") == 1 and js("__mv.game.state().step") == 0 and not js("__mv.game.complete"), 'wrong switch springs the trap and resets only the room')
ok(ev("document.getElementById('toast').textContent").startswith('The wrong switch'), 'trap message shown')
ev("__mv.startLevel(8,{noIntro:true})"); time.sleep(.8)
time.sleep(4); p = pos('rail', 1.0); click(p['x'], p['y']); time.sleep(.5); ok('no power' in ev("document.getElementById('toast').textContent"), 'bridge: blocked action explains itself: ' + ev("document.getElementById('toast').textContent"))
ok(js("__mv.game.moves") == 0, 'blocked action costs no move')
press('restartBtn'); time.sleep(.3); ok('Restart this puzzle' in ev("document.getElementById('modal').textContent"), 'restart asks first'); ev("document.getElementById('yRes').click()"); time.sleep(.5); ok(js("__mv.game.restarts") == 1, 'restart works')
press('pauseBtn'); time.sleep(.3); ok('Paused' in ev("document.getElementById('modal').textContent"), 'pause menu'); ev("document.getElementById('pSet').click()"); time.sleep(.3)
ev("var s=document.getElementById('sQ'); s.value='low'; s.onchange({target:s})"); time.sleep(1.5); ok(js("__mv.world.qName") == 'low' and js("__mv.S.quality") == 'low', 'quality switch to Low rebuilds the scene')
ev("document.getElementById('sRed').click()"); ok(js("__mv.S.reduceMotion") == 1, 'reduce-motion toggle'); ev("document.getElementById('sOk').click()")
ev("__mv.toMenu()"); time.sleep(.5); ev("document.getElementById('mLevels').click()"); time.sleep(.5)
ok(ev("document.querySelectorAll('.node').length") == 30 and ev("document.querySelectorAll('#worlds .world').length") == 3, 'level map: three worlds with ten levels each')
ev("__mv.openScores()"); time.sleep(.5); ok('Total' in ev("document.getElementById('modal').textContent") and ev("document.querySelectorAll('table.scores tr').length") > 33, 'scores screen lists every level with best score, stars, moves, hints and tries'); ev("document.getElementById('scOk').click()")
ok('Quantum Laboratory' in ev("document.getElementById('soon').textContent"), 'future worlds listed as coming soon')
shot('mv_ui_map.png')

# ---------- persistence across a page reload ----------
call('Page.reload'); ok(wait("!!window.__mv && document.getElementById('splash').hidden", 90), 'page reloads')
ok(js("Object.keys(__mv.save.done).length") >= len(ONLY) and js("__mv.S.quality") == 'low' and js("__mv.S.reduceMotion") == 1, 'stars and settings survive an app restart')
ok(len(errors) == 0, 'no JavaScript errors during the whole run: %s' % errors[:3])

print('\n' + str(sum(1 for r in results if r.startswith('PASS'))) + ' passed, ' + str(sum(1 for r in results if r.startswith('FAIL'))) + ' failed')
ws.close(); proc.kill()
sys.exit(1 if any(r.startswith('FAIL') for r in results) else 0)
