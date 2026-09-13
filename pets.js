'use strict';
const BIOMES = {Forest:'Лес',Lake:'Озеро',Desert:'Пустыня',Jungle:'Джунгли',Snow:'Снег',Volcano:'Вулкан','Abyss Ocean':'Глубины океана',Prehistoric:'Доисторический мир',Cosmic:'Космос','Cherry Blossom':'Цветущая сакура','Titan Temple':'Храм титанов','Angels & Demons':'Ангелы и демоны',Rift:'Разлом',Event:'Событие'};
const RARITIES = {Common:'Обычный',Uncommon:'Необычный',Rare:'Редкий',Epic:'Эпический',Legendary:'Легендарный',Mythic:'Мифический',Cosmic:'Космический',Secret:'Секретный',Eternal:'Вечный',Divine:'Божественный',Brainrot:'Брейнрот',Monster:'Монстр',Event:'Событийный'};
const WORDS = {dog:'собака пес пёс',chicken:'курица цыпленок',frog:'лягушка',duckling:'утенок утка',jerboa:'тушканчик',bird:'птица',catfish:'сом',fennec:'фенек',owl:'сова',raccoon:'енот',turtle:'черепаха',camel:'верблюд',chimpanzee:'шимпанзе',toucan:'тукан',penguin:'пингвин',gecko:'геккон',parrotfish:'рыба попугай',dodo:'додо',fox:'лиса',bear:'медведь',swan:'лебедь',crocodile:'крокодил',walrus:'морж',lava:'лава лавовый',swordfish:'рыба меч',crane:'журавль',dove:'голубь',axolotl:'аксолотль',snake:'змея',gorilla:'горилла',polar:'белый полярный',bull:'бык',iguana:'игуана',shark:'акула',pterodactyl:'птеродактиль',salamander:'саламандра',spider:'паук',scorpion:'скорпион',tiger:'тигр',mammoth:'мамонт',orca:'косатка',ankylosaurus:'анкилозавр',panda:'панда',lamb:'ягненок',leviathan:'левиафан',sphinx:'сфинкс',whale:'кит',beluga:'белуга белуха',triceratops:'трицератопс',koi:'карп кои',peacock:'павлин',hound:'гончая',yeti:'йети',cerberus:'цербер',kraken:'кракен',dragon:'дракон',stag:'олень',eel:'угорь',jellyfish:'медуза',gargoyle:'горгулья',centaur:'кентавр',horse:'лошадь',phoenix:'феникс',mosasaurus:'мозазавр',pegasus:'пегас пегасус',unicorn:'единорог',kitsune:'кицунэ китсуне',cthulhu:'ктулху',archangel:'архангел',elephant:'слон',snowy:'снежный полярная',ice:'ледяной',shadow:'теневой тень',cosmic:'космический',void:'пустота',rift:'разлом',red:'красный рыжая',skeleton:'скелет',king:'король',luminous:'светящийся',manta:'манта скат'};
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const transliterate = value => normalize(value).replace(/[а-я]/g, c => ({а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ж:'zh',з:'z',и:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'}[c]));
function searchText(pet) {
  return normalize([pet.name,pet.biome,BIOMES[pet.biome],pet.egg,...normalize(pet.name).split(' ').map(word=>WORDS[word] || '')].join(' '));
}
function selectPets(pets, {q='',rarity='',biome='',sort='income-desc'}={}) {
  const words=normalize(q).split(' ').filter(Boolean);
  return pets.filter(pet => (!rarity || pet.rarity===rarity) && (!biome || (pet.biome || 'unknown')===biome) && words.every(word=>searchText(pet).includes(word) || normalize(pet.name).includes(transliterate(word))))
    .sort((a,b)=>{
      if(sort==='name') return a.name.localeCompare(b.name,'en');
      if(a.income===null && b.income!==null) return 1;
      if(b.income===null && a.income!==null) return -1;
      return ((a.income || 0)-(b.income || 0))*(sort==='income-asc'?1:-1) || a.name.localeCompare(b.name,'en');
    });
}
function money(value) {
  if(value===null || !Number.isFinite(value)) return 'Уточняется';
  return '$' + new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
}
function growTime(value) {
  return value ? value.replace(/(\d+)\s*h\b/g,'$1 ч').replace(/(\d+)\s*m\b/g,'$1 мин').replace(/(\d+)\s*s\b/g,'$1 сек') : 'Нет данных';
}
function acquisition(pet) {
  const egg=pet.egg;
  if (pet.notes.some(note=>note.startsWith('Локация различается'))) return (egg ? `В карточке указано яйцо ${egg}. ` : '')+'Способ получения требует уточнения: страницы вики указывают разные локации. Ссылки — ниже.';
  if(pet.biome==='Rift') return (egg ? `Вылупи ${egg}. ` : 'Ищи этого питомца среди наград Rift. ')+'По описанию Rift Event, в разломе в лобби можно обменять трёх запрошенных питомцев на яйцо. Набор наград зависит от текущего баннера; также есть награды босса. Проверь нужное яйцо в событии.';
  if (pet.biome==='Event' || / Egg$/.test(pet.biome)) return (egg ? `Вылупи ${egg}. ` : 'Это событийный питомец. ')+'Специальные яйца получают через магазин или события, когда они доступны. Точный текущий способ добычи и шанс для этого питомца в справочнике не указаны.';
  if (pet.biome && BIOMES[pet.biome]) return `Найди ${egg || 'яйцо этого питомца'} в локации ${pet.biome} (${BIOMES[pet.biome]}), забери его из гнезда и принеси в загон на своей базе для вылупления.`+(pet.biome==='Angels & Demons'?' В этой зоне набор питомцев зависит от её текущей формы.':'');
  return 'Способ получения пока не описан в справочнике вики. Не будем угадывать яйцо или локацию.';
}

if (typeof module!=='undefined' && module.exports) module.exports={normalize,selectPets,money,growTime,acquisition};
if (typeof document!=='undefined') {
  const $=id=>document.getElementById(id);
  const form=$('catalog-filters'), grid=$('pet-grid'), query=$('pet-query');
  let catalog=null, limit=24;
  function el(tag,className,text) { const node=document.createElement(tag); if(className)node.className=className; if(text!==undefined)node.textContent=text;return node; }
  function externalLink(label,url) {
    const link=el('a','',label);
    try { const parsed=new URL(url); if(parsed.protocol==='https:' && parsed.hostname==='stealanegg.fandom.com')link.href=parsed.href; } catch {}
    link.target='_blank';link.rel='noopener noreferrer';return link;
  }
  function stat(list,label,value) { const row=el('div');row.append(el('dt','',label),el('dd','',value));list.append(row); }
  function card(pet) {
    const item=el('article','pet-card');
    item.dataset.rarity=pet.rarity;
    const art=el('div','pet-art'), badge=el('span','pet-rarity',RARITIES[pet.rarity] || pet.rarity);
    const fallback=el('span','pet-image-fallback','🥚');fallback.setAttribute('aria-hidden','true');
    art.append(fallback,badge);
    if(pet.image) {
      let valid=false;try {const u=new URL(pet.image);valid=u.protocol==='https:' && u.hostname==='static.wikia.nocookie.net';}catch{}
      if(valid) {const img=el('img');img.src=pet.image;img.alt=pet.name;img.width=180;img.height=150;img.loading='lazy';img.decoding='async';img.addEventListener('load',()=>fallback.hidden=true);img.addEventListener('error',()=>{img.remove();fallback.hidden=false;});art.append(img);}
    }
    const body=el('div','pet-card-body');
    body.append(el('p','pet-biome',BIOMES[pet.biome] || pet.biome || 'Локация уточняется'),el('h2','',pet.name));
    const revenue=el('p','pet-income',money(pet.income));revenue.append(el('span','',pet.income===null?' Доход расходится в источниках':' / сек'));body.append(revenue);
    const details=el('details','pet-details');details.append(el('summary','','Как получить и характеристики'));
    const detailBody=el('div','pet-detail-body');detailBody.append(el('h3','','Как получить'),el('p','',acquisition(pet)));
    const stats=el('dl','pet-stats');
    stat(stats,'Редкость',`${RARITIES[pet.rarity] || pet.rarity} · ${pet.rarity}`);
    stat(stats,'Локация / набор',pet.biome || 'Нет данных');
    stat(stats,'Яйцо',pet.egg || 'Название не указано');
    stat(stats,'Время роста яйца',growTime(pet.growTime));
    stat(stats,'Награда (Reward)',pet.reward || 'Нет данных');
    if(pet.reward) detailBody.append(el('p','stat-note','Reward — отдельное поле вики, не доход в секунду. Условие выдачи на карточке не поясняется. K = тысяча, M = миллион, B = миллиард.'));
    detailBody.append(stats);
    if(pet.income===null)detailBody.append(el('p','data-warning','В источниках: '+pet.incomeVariants.map(money).join(' или ')+' в секунду.'));
    for(const note of pet.notes) detailBody.append(el('p','data-warning',note));
    detailBody.append(el('p','stat-note','Значения из фан-вики. Размер, мутации и изменения баланса влияют на фактический доход.'));
    const links=el('div','pet-source-links');
    pet.sources.forEach((url,i)=>links.append(externalLink(i===0?'Справочник ↗':`Источник ${i+1} ↗`,url)));
    links.append(externalLink('Получение яиц ↗','https://stealanegg.fandom.com/wiki/'+(pet.biome==='Rift'?'Rift_Event':pet.biome==='Angels & Demons'?'Angels_%26_Demons':'Eggs')));
    if(pet.imageSource)links.append(externalLink('Изображение ↗',pet.imageSource));
    detailBody.append(links);details.append(detailBody);body.append(details);item.append(art,body);return item;
  }
  function state() {return {q:query.value,rarity:$('rarity-filter').value,biome:$('biome-filter').value,sort:$('sort-filter').value};}
  function render(updateUrl=true) {
    if(!catalog)return;
    const filters=state(), pets=selectPets(catalog.pets,filters);
    const visible=pets.slice(0,limit);grid.replaceChildren(...visible.map(card));
    $('results-count').textContent=`Найдено ${pets.length} из ${catalog.pets.length} · показано ${visible.length}`;
    $('catalog-empty').hidden=pets.length>0;$('load-more').hidden=pets.length<=limit;$('clear-search').hidden=!query.value;
    if(updateUrl){const params=new URLSearchParams();for(const [key,value] of Object.entries(filters))if(value && !(key==='sort'&&value==='income-desc'))params.set(key,value);history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():'')+location.hash);}
  }
  function restoreUrl() {const params=new URLSearchParams(location.search);query.value=(params.get('q')||'').slice(0,100);for(const key of ['rarity','biome','sort']) {const control=$(key+'-filter'), value=params.get(key);control.value=[...control.options].some(o=>o.value===value)?value:(key==='sort'?'income-desc':'');}}
  async function load() {
    $('catalog-error').hidden=true;$('results-count').textContent='Загрузка питомцев…';
    try {
      const response=await fetch('data/pets.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('Data unavailable');
      const data=await response.json();
      if(data.schemaVersion!==1 || !Array.isArray(data.pets) || !data.pets.length || !Number.isFinite(Date.parse(data.checkedAt)))throw Error('Invalid catalog');
      catalog=data;$('pet-total').textContent=data.pets.length;
      for(const [id,key,labels] of [['rarity-filter','rarity',RARITIES],['biome-filter','biome',BIOMES]]) {
        const select=$(id);while(select.options.length>1)select.remove(1);
        [...new Set(data.pets.map(p=>p[key]||'unknown'))].sort().forEach(value=>{const option=el('option','',value==='unknown'?'Не указана':`${labels[value] || value}${labels[value]?' · '+value:''}`);option.value=value;select.append(option);});
      }
      const age=(Date.now()-Date.parse(data.checkedAt))/86400000;
      $('catalog-date').textContent='Проверено '+new Intl.DateTimeFormat('ru-RU',{dateStyle:'long'}).format(new Date(data.checkedAt))+(age>8?' · Данные старше недели':'');
      $('catalog-date').classList.toggle('data-warning',age>8);
      restoreUrl();render(false);
    } catch(error) {$('catalog-error').hidden=false;$('results-count').textContent='Каталог временно недоступен';$('catalog-date').textContent='Дата проверки недоступна';}
  }
  form.addEventListener('submit',event=>{event.preventDefault();limit=24;render();});
  query.addEventListener('input',()=>{limit=24;render();});
  for(const id of ['rarity-filter','biome-filter','sort-filter'])$(id).addEventListener('change',()=>{limit=24;render();});
  form.addEventListener('reset',()=>queueMicrotask(()=>{limit=24;render();}));
  $('clear-search').addEventListener('click',()=>{query.value='';limit=24;render();query.focus();});
  $('empty-reset').addEventListener('click',()=>{form.reset();query.focus();});
  $('load-more').addEventListener('click',()=>{limit+=24;render();});
  $('retry-load').addEventListener('click',load);
  window.addEventListener('popstate',()=>{restoreUrl();limit=24;render(false);});
  load();
}
