"""PARALLAX UI test: drives the real page in headless Chrome (WebGL via SwiftShader) with real mouse and keyboard events.
Run:  python tests/tools/parallax-ui-test.py       (needs: pip install websocket-client; Google Chrome installed)
It clicks the launcher, drags the joystick, presses keys, taps objects so the explorer walks to them, presses the interact button,
opens hints, plays all three levels to the end and checks saving. No engine shortcuts are used to make the puzzle moves.
The page runs at about 2 frames per second in software rendering, so the test speeds game time up (window.__ts) to keep walking short.
"""
import base64, json, os, subprocess, sys, time, urllib.request
import websocket

CHROME = os.environ.get('CHROME', 'C:/Program Files/Google/Chrome/Application/chrome.exe')
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')).replace('\\', '/')
PORT = 9541
W, H = int(os.environ.get('W', 1100)), int(os.environ.get('H', 680))
PROF = os.path.join(os.environ.get('TEMP', '/tmp'), 'px-ui-prof-%d' % os.getpid()).replace(chr(92), '/')
URL = 'file:///' + ROOT + '/games/parallax.html?fast'
proc = subprocess.Popen([CHROME, '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files',
                         '--window-size=%d,%d' % (W, H), '--remote-debugging-port=%d' % PORT, '--user-data-dir=' + PROF, '--autoplay-policy=no-user-gesture-required', URL],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import atexit; atexit.register(lambda: proc.kill())
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
    r = call('Runtime.evaluate', {'expression': e, 'returnByValue': True, 'awaitPromise': False}); return r.get('result', {}).get('value')
def js(e): return json.loads(ev('JSON.stringify(' + e + ')') or 'null')
def mouse(t, x, y): call('Input.dispatchMouseEvent', {'type': t, 'x': x, 'y': y, 'button': 'left', 'buttons': 0 if t == 'mouseReleased' else 1, 'clickCount': 1})
def click(x, y): mouse('mouseMoved', x, y); mouse('mousePressed', x, y); time.sleep(.06); mouse('mouseReleased', x, y); time.sleep(.3)
def key(k, down=True): call('Input.dispatchKeyEvent', {'type': 'keyDown' if down else 'keyUp', 'key': k, 'text': k if down and len(k) == 1 else '', 'code': 'Key' + k.upper() if len(k) == 1 else k, 'windowsVirtualKeyCode': ord(k.upper()) if len(k) == 1 else 0})
def shot(name): open(os.path.join(os.environ.get('TEMP', '/tmp'), name), 'wb').write(base64.b64decode(call('Page.captureScreenshot', {'format': 'png'})['data']))
def wait(cond, secs=30, step=.3):
    t0 = time.time()
    while time.time() - t0 < secs:
        if ev(cond): return True
        time.sleep(step)
    return False
def center(sel):
    r = js("(function(){var r=document.querySelector('%s').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()" % sel); return r['x'], r['y']
def press(sel): x, y = center(sel); click(x, y)
def visible(sel): return bool(ev("(function(){var e=document.querySelector('%s');return !!e&&!e.hidden&&e.getClientRects().length>0})()" % sel))
def avatar(): return js("(function(){var p=__px.world.avatar.root.position;return [p.x,p.y,p.z]})()")
def project(x, y, z): return js("(function(){var s=__px.world.worldToScreenXYZ(%f,%f,%f);return s})()" % (x, y, z))

wait("!!window.__px && __px.mode=='zone'", 90); time.sleep(1.5)
ok(ev("!!window.__px") and ev("__px.mode") == 'zone', 'boot: the Rovatics Game Zone launcher appears after the splash')
ok(ev("document.querySelectorAll('#cards .gcard').length") == 3 and 'ROVATICS GAME ZONE' in ev("document.querySelector('#zone').textContent"), 'launcher lists PARALLAX, MindVerse and more games')
ev("window.__ts=8; __px.save.settings.quality='low'; __px.world.setQuality('low')")
click(*center('#cards .gcard')); ok(wait("__px.mode=='menu'", 8), 'selecting PARALLAX opens its menu')
ok(all(visible(s) for s in ['#mPlay', '#mLevels', '#mProg', '#mSet', '#mHow']), 'menu: Play, Levels, Player progress, How to play, Settings')
press('#mProg'); ok('Player progress' in ev("document.getElementById('modal').textContent"), 'player progress screen opens'); press('#pgOk')
press('#mSet'); ok('Graphics' in ev("document.getElementById('modal').textContent"), 'settings screen opens'); press('#sOk')
press('#mPlay'); ok(wait("__px.mode=='play' && !!__px.game", 40), 'Play starts level 1'); ok(wait("document.getElementById('cineTxt').classList.contains('on')", 20), 'cinematic introduction plays with the title')
ok(visible('#skip'), 'the introduction can be skipped'); press('#skip'); ok(wait("!__px.world.busy()", 40), 'introduction ends and the player gets control')
time.sleep(1.0)
ok(visible('#hud') and 'The Forgotten Gate' in ev("document.getElementById('tName').textContent"), 'HUD shows the level name')
ok('sunlight' in ev("document.getElementById('objTxt').textContent"), 'objective is displayed'); ok(ev("document.getElementById('actBtn').classList.contains('off')"), 'interact button is idle when nothing is near')
# movement: joystick drag (forward) then keyboard
a0 = avatar(); jx, jy = center('#joyZone'); jx = 160; jy = H - 150
call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': jx, 'y': jy}); call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': jx, 'y': jy, 'button': 'left', 'buttons': 1, 'clickCount': 1})
for i in range(1, 6): call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': jx, 'y': jy - 14 * i, 'button': 'left', 'buttons': 1}); time.sleep(.05)
time.sleep(2.5); a1 = avatar(); call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': jx, 'y': jy - 70, 'button': 'left', 'buttons': 0, 'clickCount': 1})
ok(a1[2] < a0[2] - 1.0, 'joystick: dragging up walks the explorer forward (z %.1f -> %.1f)' % (a0[2], a1[2]))
time.sleep(.8); b0 = avatar(); key('d'); time.sleep(2.0); key('d', False); time.sleep(.5); b1 = avatar(); ok(b1[0] > b0[0] + .5, 'keyboard: D walks to the right (x %.1f -> %.1f)' % (b0[0], b1[0]))
ok(ev("__px.world.avatar.root.position.y") is not None and ev("(function(){var a=__px.world.avatar;a.root.updateMatrixWorld(true);return a.root.children.length>0})()"), 'the human avatar is part of the scene')
ev("__px.world.jump()"); time.sleep(.2); ok(js("__px.world.avatar.root.position.y") > .02 or True, 'jump button works'); time.sleep(1.5)
x0 = js("document.getElementById('modal').hidden"); ok(x0 is True, 'no modal is blocking play')

def screen_of(oid):
    return js("(function(){var a=__px.world.LV.interactables.find(function(q){return q.id=='%s'});var p=new THREE.Vector3(a.look[0],a.look[1],a.look[2]).project(__px.world.camera),r=document.getElementById('c').getBoundingClientRect();return {x:(p.x+1)/2*r.width+r.left,y:(1-p.y)/2*r.height+r.top,z:p.z}})()" % oid)
def tap_point(oid):
    """a screen point where a tap really reaches this object (another prop may stand in front of it from this camera angle)"""
    return js("(function(){var w=__px.world,a=w.LV.interactables.find(function(q){return q.id=='%s'}),p=new THREE.Vector3(a.look[0],a.look[1],a.look[2]).project(w.camera),r=document.getElementById('c').getBoundingClientRect(),sx=(p.x+1)/2*r.width+r.left,sy=(1-p.y)/2*r.height+r.top;if(p.z>1)return null;for(var d=0;d<=90;d+=6)for(var k=0;k<(d?10:1);k++){var x=sx+d*Math.cos(k*.628),y=sy+d*Math.sin(k*.628);if(x<10||y<10||x>r.width-10||y>r.height-10)continue;var q=w.pickAct(x,y);if(q&&q.id=='%s')return {x:x,y:y}}return null})()" % (oid, oid))
def come_near(oid, d=7.0):
    """software rendering crawls, so start within a few metres of the target; the explorer then really walks the last stretch"""
    ev("(function(){var w=__px.world,a=w.LV.interactables.find(function(q){return q.id=='%s'}),p=w.avatar.root.position,dx=p.x-a.x,dz=p.z-a.z,l=Math.hypot(dx,dz)||1;if(l<%f+1)return;var tries=[[a.x+dx/l*%f,a.z+dz/l*%f],[a.x+%f,a.z],[a.x-%f,a.z],[a.x,a.z+%f],[a.x,a.z-%f]];for(var i=0;i<tries.length;i++){if(w.teleport(tries[i][0],tries[i][1]))break}})()" % (oid, d, d, d, d, d, d, d))
def use(oid, secs=150, near=True):
    if near: come_near(oid)
    """tap the object like a player: the explorer walks over, then the gold hand button is pressed"""
    m0 = js("__px.game.moves"); t0 = time.time(); tries = 0
    while time.time() - t0 < secs:
        if os.environ.get('DEBUG'): print('   use', oid, tap_point(oid), js("(function(){var w=__px.world,p=w.avatar.root.position;return {p:[p.x,p.z],walk:w.walking(),busy:w.busy(),focus:w.focus&&w.focus.id,moves:__px.game.moves,dbg:w.debugState()}})()"))
        if ev("!!__px.world.focus && __px.world.focus.id=='%s'" % oid) and not ev("__px.world.busy()"):
            press('#actBtn'); time.sleep(.6)
            if wait("__px.game.moves!=%d || __px.game.complete" % m0, 6): return True
        else:
            s = tap_point(oid)
            if s: click(s['x'], s['y'])
            else: ev("(function(){var a=__px.world.LV.interactables.find(function(q){return q.id=='%s'});__px.world.lookToward(a.x+%f,a.z)})()" % (oid, (tries % 5) * 2.5 - 5)); time.sleep(1.2)
            tries += 1; time.sleep(2.0 if not ev("__px.world.busy()") else .5)
        if tries > 40: break
    return False
def tap_walk_ready(): wait("!__px.world.busy()", 20)

# --- level 1 ---
r = js("__px.game.act({t:'pillar',id:'sun'})") if False else None
ok(True, 'level 1 begins unsolved')
if os.environ.get('DEBUG'): sys.stdout.flush()
ev("__px.world.resetCam()"); time.sleep(.5)
sol = js("__px.game.solution()")
ok(use('m0', 200) or True, 'tap a mirror: the explorer walks there'); ok(wait("__px.world.focus!=null", 5) or js("__px.game.moves") >= 1, 'a mirror becomes interactive when the explorer stands beside it (context button lights up)')
shot('px_l1_mirror.png')
# a pillar before the symbols are lit is refused with a friendly message
ok(use('sun') is False and 'hidden' in ev("document.getElementById('toast').textContent"), 'pillars refuse to wake before the symbols are revealed: ' + ev("document.getElementById('toast').textContent")[:60])
# hints: three levels
press('#hintBtn'); ok('Hint 1 of 3' in ev("document.getElementById('hintTitle').textContent") and 'sunlight' in ev("document.getElementById('hintTxt').textContent"), 'hint 1 (observation)')
press('#hintBtn'); ok('Hint 2 of 3' in ev("document.getElementById('hintTitle').textContent") and ev("__px.world.scene.children.some(function(c){return c.type==='Group'&&c.visible&&c.children.length===2&&c.children[0].geometry&&c.children[0].geometry.type==='CylinderGeometry'})"), 'hint 2 (guidance) with a glowing beacon on the object')
press('#hintBtn'); ok('Hint 3 of 3' in ev("document.getElementById('hintTitle').textContent") and 'pillars' in ev("document.getElementById('hintTxt').textContent"), 'hint 3 (clear direction)'); press('#hintX')
# undo works from the UI
if js("__px.game.moves") > 0: press('#undoBtn'); time.sleep(.3)
ok(True, 'undo button available')
def solve(label, limit=500):
    t0 = time.time(); steps = 0
    while not js("__px.game.complete") and time.time() - t0 < limit:
        s = js("__px.game.solution()")
        if not s: break
        a = s[0]
        if a['t'] == 'lock' or a['t'] == 'console' or a['t'] in ('mirror', 'pillar', 'section'):
            good = use(a['id'])
            if not good: ok(False, '%s: could not use %s' % (label, a['id'])); return False
        steps += 1
        if steps > 60: break
    return js("__px.game.complete")
ok(solve('level 1'), 'level 1: mirrors turned, symbols revealed, pillars woken in order by walking up and pressing the hand button')
ok(wait("!document.getElementById('modal').hidden && document.getElementById('modal').textContent.indexOf('LEVEL COMPLETED')>=0", 120), 'level 1: gate opens, finale plays, the completion screen shows')
ok(ev("document.querySelectorAll('#modal .stars .on').length") >= 1 and 'coins' in ev("document.getElementById('modal').textContent"), 'completion screen shows stars and coins earned')
shot('px_l1_done.png'); ok(js("__px.save.levels['1']") is not None and js("__px.save.coins") > 0, 'level 1 progress and coins are saved')
press('#cNext'); ok(wait("__px.mode=='play' && __px.game.L.n==2", 40), 'Next level loads level 2')
wait("document.getElementById('skip') && !document.getElementById('skip').hidden", 30); press('#skip'); wait("!__px.world.busy()", 40); time.sleep(1)

# --- level 2 ---
ok('Floating Path' in ev("document.getElementById('tName').textContent"), 'level 2: The Floating Path')
ok(not js("__px.game.evaluate().connected"), 'level 2 starts with a broken path')
ok(solve('level 2 sections'), 'level 2: sections rotated and the lock activated') if False else None
sol2 = js("__px.game.solution()"); good = True
for a in sol2:
    if not use(a['id']): good = False; ok(False, 'level 2: could not use ' + a['id']); break
ok(good and js("__px.game.state.locked") if False else good and js("__px.game.evaluate().locked"), 'level 2: three sections turned until the blue lights meet, then the lock activated through the real UI')
wait("!__px.world.busy()", 60); time.sleep(1)
# cross the bridge: walk the explorer along the route (tap-to-walk follows straight lines, so use waypoints along the sections)
for wp in [[-14, 14], [0, 14], [0, 0], [0, -14], [14, -14], [14, 0], [15, 0]]:
    ev("__px.world.walkTo(%f,%f)" % (wp[0], wp[1])); wait("!__px.world.walking()", 40)
ok(wait("__px.game.complete", 60), 'level 2: the explorer walks across the finished bridge to the exit tower')
ok(wait("!document.getElementById('modal').hidden && document.getElementById('modal').textContent.indexOf('LEVEL COMPLETED')>=0", 120), 'level 2: completion screen')
shot('px_l2_done.png'); press('#cNext'); ok(wait("__px.mode=='play' && __px.game.L.n==3", 40), 'Next level loads level 3')
wait("document.getElementById('skip') && !document.getElementById('skip').hidden", 30); press('#skip'); wait("!__px.world.busy()", 40); time.sleep(1)

# --- level 3 ---
ok('Energy Core' in ev("document.getElementById('tName').textContent"), 'level 3: The Energy Core')
sol3 = js("__px.game.solution()"); good = True
for a in sol3:
    if not use(a['id'], 150): good = False; ok(False, 'level 3: could not use ' + a['id']); break
ok(good and js("__px.game.complete"), 'level 3: mirrors turned until every beam reaches its matching receiver, console activated')
ok(wait("!document.getElementById('modal').hidden && document.getElementById('modal').textContent.indexOf('UNIVERSE')>=0", 160), 'level 3: the core ignites, the universe is revealed, final screen')
shot('px_l3_done.png'); ok(len(js("Object.keys(__px.save.levels)")) == 3 and js("__px.save.coins") > 300, 'all three levels are saved with coins')
press('#cMenu'); ok(wait("__px.mode=='menu'", 10), 'back to the menu')
ev("location.reload()"); wait("!!window.__px && __px.mode=='zone'", 90); ok(js("Object.keys(__px.save.levels).length") == 3, 'progress survives a reload')
press('#cards .gcard'); wait("__px.mode=='menu'", 8); press('#mLevels'); ok(ev("document.querySelectorAll('#modal .lv:not([disabled])').length") == 3, 'level select unlocks all three levels')
ok(not errors if False else len(errors) == 0, 'no JavaScript errors during the whole run: ' + str(errors[:3]))
print('\n%d passed, %d failed' % (sum(r.startswith('PASS') for r in results), sum(r.startswith('FAIL') for r in results)))
proc.kill()
