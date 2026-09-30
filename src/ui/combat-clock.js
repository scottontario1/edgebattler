import './combat-clock.css';
export function createCombatClock(){
  const element=document.createElement('section');element.className='combat-clock';element.hidden=true;element.setAttribute('aria-label','Combat timeline');
  document.body.appendChild(element);
  let duration=18,marks=[];
  function update(elapsed){
    const time=Math.max(0,Math.min(duration,elapsed));
    element.querySelector('.combat-countdown').textContent=(duration-time).toFixed(1)+'s';
    element.querySelector('.combat-progress').style.width=(time/duration*100)+'%';
    for(const node of element.querySelectorAll('[data-time]')){
      const t=Number(node.dataset.time);node.classList.toggle('past',time>=t);node.classList.toggle('next',t===marks.find(t=>t>time));
    }
  }
  function start({duration:seconds=18,skillTimes=[3,9,15]}={}){
    duration=seconds;marks=skillTimes;
    element.innerHTML=`<div class="combat-heading"><b>Combat</b><span class="combat-countdown"></span></div><div class="combat-track"><i class="combat-progress"></i>${marks.map(t=>`<span class="combat-mark" data-time="${t}" style="left:${t/duration*100}%"><small>Skill ${t}s</small></span>`).join('')}</div>`;
    element.hidden=false;update(0);
  }
  function finish(){update(duration);element.querySelector('.combat-countdown').textContent='Complete';}
  return {element,start,update,finish,hide:()=>{element.hidden=true;}};
}
