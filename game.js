(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const $ = id => document.getElementById(id);
  const overlay = $('overlay'), resultOverlay = $('resultOverlay');
  const keys = new Set();
  let running = false, won = false, soundOn = true, audio, last = 0, elapsed = 0;
  let player, creature, tapes, battery, collectCount, flash, noiseTimer = 0;
  const obstacles = [
    {x:62,y:64,w:162,h:102,name:'MILLER HOUSE',color:'#39342d',roof:'#4b4038',lit:true},
    {x:286,y:62,w:155,h:100,name:'HOLLOWAY MOTEL',color:'#3b3530',roof:'#51433a'},
    {x:660,y:58,w:202,h:116,name:'RADIO STATION',color:'#3c3934',roof:'#514b41',lit:true},
    {x:74,y:258,w:170,h:102,name:'DINER',color:'#3b3430',roof:'#55443c',lit:true},
    {x:382,y:250,w:195,h:126,name:'BLACKRIDGE HIGH',color:'#36353a',roof:'#47444a'},
    {x:700,y:257,w:163,h:104,name:'VIDEO CLUB',color:'#37333a',roof:'#49404a',lit:true},
    {x:278,y:438,w:192,h:100,name:'HARDWARE',color:'#393932',roof:'#4b493c'},
    {x:586,y:430,w:193,h:104,name:'WATER TOWER',color:'#37383a',roof:'#494c4d'}
  ];
  const treeSpots = [];
  for (let y=25;y<590;y+=49) for(let x=14;x<950;x+=58){
    if (x>48&&x<900&&y>43&&y<560 && !obstacles.some(o=>x>o.x-28&&x<o.x+o.w+28&&y>o.y-27&&y<o.y+o.h+28) && !(x>245&&x<690&&y>180&&y<415)) treeSpots.push({x:x+(y%3)*7,y:y+(x%2)*9,r:8+(x*y%5)});
  }
  function reset(){
    player={x:320,y:207,dir:0,r:9,speed:122};
    creature={x:900,y:207,r:13,active:false,alert:0};
    tapes=[{x:140,y:208,found:false},{x:524,y:123,found:false},{x:805,y:406,found:false},{x:330,y:393,found:false}];
    battery=100;collectCount=0;elapsed=0;flash=0;noiseTimer=0;won=false;
    $('collectCount').textContent='00';$('progressFill').style.width='0%';$('batteryText').textContent='100%';$('frequencyText').textContent='88.4';$('threatState').textContent='CLEAR';$('radarThreat').classList.add('hidden');$('logText').textContent='The radio started by itself.';$('statusText').textContent='SIGNAL DETECTED';$('hintText').textContent='TUNE IN. STAY QUIET.';$('sceneLabel').textContent='THE OLD TOWN';
    $('resultEyebrow').textContent='TRANSMISSION COMPLETE';$('resultTitle').textContent='YOU MADE IT OUT.';$('resultCopy').textContent='The recordings are safe. For now.';resultOverlay.classList.add('hidden');
    draw();
  }
  function sound(freq=420,duration=.12,type='sine'){
    if(!soundOn)return;
    try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.055,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch(e){}
  }
  function start(){reset();running=true;overlay.classList.add('hidden');last=performance.now();requestAnimationFrame(loop);sound(270,.25,'triangle');}
  function end(success){running=false;won=success;$('resultEyebrow').textContent=success?'TRANSMISSION COMPLETE':'SIGNAL LOST';$('resultTitle').textContent=success?'YOU MADE IT OUT.':'IT FOUND YOU.';$('resultCopy').textContent=success?'The recordings are safe. For now.':'Blackridge keeps its secrets. Try another route.';resultOverlay.classList.remove('hidden');sound(success?660:90,.5,success?'sine':'sawtooth');}
  function collides(x,y,r){return obstacles.some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h)}
  function moveEntity(entity,dx,dy){let nx=Math.max(16,Math.min(W-16,entity.x+dx));if(!collides(nx,entity.y,entity.r))entity.x=nx;let ny=Math.max(16,Math.min(H-16,entity.y+dy));if(!collides(entity.x,ny,entity.r))entity.y=ny}
  function update(dt){
    elapsed+=dt;flash=Math.max(0,flash-dt*2);noiseTimer=Math.max(0,noiseTimer-dt);
    let dx=(keys.has('ArrowRight')||keys.has('d')||keys.has('D')?1:0)-(keys.has('ArrowLeft')||keys.has('a')||keys.has('A')?1:0);
    let dy=(keys.has('ArrowDown')||keys.has('s')||keys.has('S')?1:0)-(keys.has('ArrowUp')||keys.has('w')||keys.has('W')?1:0);
    const runningFast=(keys.has('Shift')||$('runButton').classList.contains('pressed'))&&battery>1;
    if(dx||dy){let l=Math.hypot(dx,dy);dx/=l;dy/=l;player.dir=Math.atan2(dy,dx);moveEntity(player,dx*(runningFast?190:122)*dt,dy*(runningFast?190:122)*dt);if(runningFast){battery=Math.max(0,battery-11*dt);noiseTimer=.6}else battery=Math.min(100,battery+4*dt)}else battery=Math.min(100,battery+6*dt);
    if(!creature.active && elapsed>2.5)creature.active=true;
    const dist=Math.hypot(player.x-creature.x,player.y-creature.y);
    if(creature.active){let detection=runningFast?470:350;if(dist<detection||noiseTimer>0){creature.alert=Math.min(1,creature.alert+dt*.75)}else creature.alert=Math.max(0,creature.alert-dt*.17);
      if(creature.alert>.04){let a=Math.atan2(player.y-creature.y,player.x-creature.x),speed=51+creature.alert*38+(runningFast?16:0);moveEntity(creature,Math.cos(a)*speed*dt,Math.sin(a)*speed*dt)}
      if(dist<24){end(false);return}
    }
    for(const tape of tapes){if(!tape.found&&Math.hypot(player.x-tape.x,player.y-tape.y)<23){tape.found=true;collectCount++;flash=1;$('collectCount').textContent=String(collectCount).padStart(2,'0');$('progressFill').style.width=`${collectCount*25}%`;$('frequencyText').textContent=(88.4+collectCount*.7).toFixed(1);$('logText').textContent=['A voice counting backward.','The lights went out at 9:12.','It knows my name.','We opened the door.'][collectCount-1];$('hintText').textContent=collectCount===4?'THE VAN IS BY THE HIGHWAY.':'RECORDING RECOVERED — '+(4-collectCount)+' LEFT';sound(520+collectCount*110,.24,'triangle');}}
    const exit=Math.hypot(player.x-905,player.y-304);
    if(collectCount===4&&exit<45){end(true);return}
    if(collectCount===4){$('sceneLabel').textContent='HIGHWAY — VAN';$('statusText').textContent='GET TO THE VAN';}else if(dist<180){$('statusText').textContent='SOMETHING IS NEAR';$('threatState').textContent='CLOSE';$('threatState').style.color='#ef6558';$('hintText').textContent='DON’T LET IT GET CLOSE';}else{$('statusText').textContent='SIGNAL DETECTED';$('threatState').textContent=creature.alert>.2?'SEARCHING':'CLEAR';$('threatState').style.color='';}
    $('batteryText').textContent=Math.round(battery)+'%';
    const radar=$('radarThreat');if(creature.active){radar.classList.remove('hidden');radar.style.left=`${Math.max(4,Math.min(94,50+(creature.x-player.x)/10))}%`;radar.style.top=`${Math.max(4,Math.min(90,50+(creature.y-player.y)/6))}%`}
    const timeMinutes=47+Math.floor(elapsed/60);const hour=11+Math.floor(timeMinutes/60);$('clock').textContent=`${String(((hour-1)%12)+1).padStart(2,'0')}:${String(timeMinutes%60).padStart(2,'0')} PM`;
  }
  function loop(now){if(!running)return;const dt=Math.min(.04,(now-last)/1000);last=now;update(dt);draw();if(running)requestAnimationFrame(loop)}
  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#18221b';ctx.fillRect(0,0,W,H);
    // forest texture
    for(let i=0;i<180;i++){let x=(i*173+31)%W,y=(i*97+53)%H;if(!obstacles.some(o=>x>o.x-5&&x<o.x+o.w+5&&y>o.y-5&&y<o.y+o.h+5)){ctx.fillStyle=i%3?'#1a251d':'#1c281f';ctx.fillRect(x,y,24+(i%4)*4,2)}}
    // town road grid
    ctx.fillStyle='#292a2b';ctx.fillRect(0,188,W,38);ctx.fillRect(0,388,W,36);ctx.fillRect(250,0,31,H);ctx.fillRect(605,0,35,H);
    ctx.strokeStyle='#6d5f48';ctx.globalAlpha=.5;ctx.setLineDash([14,14]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,207);ctx.lineTo(W,207);ctx.moveTo(0,406);ctx.lineTo(W,406);ctx.moveTo(265,0);ctx.lineTo(265,H);ctx.moveTo(622,0);ctx.lineTo(622,H);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    // trees
    for(const t of treeSpots){ctx.fillStyle='#101712';ctx.beginPath();ctx.ellipse(t.x+2,t.y+6,t.r+2,t.r*.72,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#27372b';ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#334531';ctx.beginPath();ctx.arc(t.x-2,t.y-2,t.r*.65,0,Math.PI*2);ctx.fill();ctx.fillStyle='#1a251e';ctx.fillRect(t.x-1,t.y+5,3,7)}
    // buildings
    for(const o of obstacles){ctx.fillStyle='#131510';ctx.fillRect(o.x+5,o.y+7,o.w,o.h);ctx.fillStyle=o.color;ctx.fillRect(o.x,o.y,o.w,o.h);ctx.fillStyle=o.roof;ctx.fillRect(o.x+5,o.y+6,o.w-10,o.h-12);ctx.strokeStyle='#746a5d';ctx.globalAlpha=.38;ctx.strokeRect(o.x+5.5,o.y+6.5,o.w-11,o.h-13);ctx.globalAlpha=1;
      // roof details
      ctx.fillStyle='#282a29';ctx.fillRect(o.x+o.w*.24,o.y+o.h*.26,o.w*.23,o.h*.2);ctx.fillRect(o.x+o.w*.61,o.y+o.h*.55,o.w*.2,o.h*.16);
      if(o.lit){ctx.fillStyle='#e8a65b';ctx.globalAlpha=.85;ctx.fillRect(o.x+o.w*.1,o.y+o.h-12,7,5);ctx.fillRect(o.x+o.w*.85,o.y+o.h-12,7,5);ctx.globalAlpha=1}
      ctx.fillStyle='#aaa18a';ctx.font='7px monospace';ctx.textAlign='center';ctx.fillText(o.name,o.x+o.w/2,o.y+o.h+13);
    }
    // van, exit
    ctx.fillStyle='#d3b86e';ctx.fillRect(879,280,52,22);ctx.fillStyle='#25282a';ctx.fillRect(886,283,15,8);ctx.fillRect(906,283,17,8);ctx.fillStyle='#151719';ctx.beginPath();ctx.arc(890,304,4,0,7);ctx.arc(920,304,4,0,7);ctx.fill();ctx.fillStyle='#e0bb6c';ctx.font='8px monospace';ctx.textAlign='center';ctx.fillText('RADIO VAN',905,270);
    if(collectCount<4){ctx.fillStyle='#35383b';ctx.fillRect(878,265,54,49);ctx.fillStyle='#44474a';ctx.fillRect(870,260,5,60)}
    // tape pickups
    for(const t of tapes){if(t.found)continue;let pulse=1+Math.sin(elapsed*4+t.x)*.13;ctx.save();ctx.translate(t.x,t.y);ctx.scale(pulse,pulse);ctx.shadowColor='#e7b763';ctx.shadowBlur=15;ctx.fillStyle='#ddba72';ctx.fillRect(-6,-5,12,10);ctx.shadowBlur=0;ctx.fillStyle='#342d27';ctx.fillRect(-3,-3,6,6);ctx.fillStyle='#eddfb6';ctx.fillRect(-4,-2,2,2);ctx.restore()}
    // monster shadow and body
    if(creature.active){ctx.save();ctx.translate(creature.x,creature.y);ctx.fillStyle='#08090c';ctx.shadowColor='#ba2830';ctx.shadowBlur=creature.alert*20;ctx.beginPath();ctx.ellipse(0,5,13,16,0,0,7);ctx.fill();ctx.fillStyle='#17161a';ctx.beginPath();ctx.moveTo(-9,-7);ctx.lineTo(-14,-18);ctx.lineTo(-5,-12);ctx.lineTo(0,-22);ctx.lineTo(5,-12);ctx.lineTo(14,-18);ctx.lineTo(9,-5);ctx.lineTo(8,10);ctx.lineTo(-8,10);ctx.closePath();ctx.fill();ctx.fillStyle='#e34b48';ctx.fillRect(-5,-5,3,2);ctx.fillRect(3,-5,3,2);ctx.restore()}
    // player with flashlight
    ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.dir);ctx.shadowColor='#e6bb70';ctx.shadowBlur=12;ctx.fillStyle='#c9b991';ctx.beginPath();ctx.arc(0,0,8,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#d8cfb6';ctx.fillRect(1,-5,9,3);ctx.fillStyle='#2d302d';ctx.fillRect(-4,6,3,5);ctx.fillRect(3,6,3,5);ctx.restore();
    // flashlight beam & ambient darkness
    ctx.save();ctx.globalCompositeOperation='source-over';const grad=ctx.createRadialGradient(player.x,player.y,20,player.x,player.y,310);grad.addColorStop(0,'rgba(226,194,130,.13)');grad.addColorStop(.52,'rgba(15,18,18,.22)');grad.addColorStop(1,'rgba(3,5,9,.7)');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);ctx.restore();
    // little CRT scanlines
    ctx.fillStyle='rgba(190,205,180,.025)';for(let y=0;y<H;y+=4)ctx.fillRect(0,y,W,1);
    if(flash>0){ctx.fillStyle=`rgba(234,177,91,${flash*.13})`;ctx.fillRect(0,0,W,H)}
    ctx.fillStyle='rgba(230,220,190,.28)';ctx.font='9px monospace';ctx.textAlign='left';ctx.fillText('BLACKRIDGE COUNTY  /  OCT 24 1986',18,20);
    if(collectCount===4){ctx.fillStyle='rgba(237,181,96,.9)';ctx.textAlign='center';ctx.font='10px monospace';ctx.fillText('VAN READY — REACH THE HIGHWAY',905,334)}
  }
  $('startButton').addEventListener('click',start);$('restartButton').addEventListener('click',start);
  $('soundButton').addEventListener('click',()=>{soundOn=!soundOn;$('soundButton').innerHTML=`♫ <span>SOUND ${soundOn?'ON':'OFF'}</span>`;if(soundOn)sound(440,.1)});
  window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key);if(e.key.toLowerCase()==='m')$('soundButton').click();if(!running&&e.key==='Enter'&&!resultOverlay.classList.contains('hidden'))start()});window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>keys.clear());
  document.querySelectorAll('.mobile-pad button').forEach(button=>{const dir=button.dataset.dir;const map={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'};button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(map[dir])});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>button.addEventListener(ev,()=>keys.delete(map[dir])))});
  $('runButton').addEventListener('pointerdown',e=>{e.preventDefault();$('runButton').classList.add('pressed')});['pointerup','pointercancel','pointerleave'].forEach(ev=>$('runButton').addEventListener(ev,()=>$('runButton').classList.remove('pressed')));
  reset();
})();
