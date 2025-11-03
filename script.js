// script.js (module)
const OPENWEATHER_API_KEY = ''; // <-- REPLACE THIS with your key

// Elements
const cityInput = document.getElementById('cityInput');
const searchForm = document.getElementById('searchForm');
const suggestionsEl = document.getElementById('suggestions');
const statusEl = document.getElementById('status');
const savedEl = document.getElementById('saved');
const historyRow = document.getElementById('historyRow');

const cityNameEl = document.getElementById('cityName');
const descEl = document.getElementById('description');
const tempEl = document.getElementById('temperature');
const feelsEl = document.getElementById('feelsLike');
const iconEl = document.getElementById('weatherIcon');
const humidityEl = document.getElementById('humidity');
const windEl = document.getElementById('wind');
const pressureEl = document.getElementById('pressure');
const visibilityEl = document.getElementById('visibility');
const sunriseEl = document.getElementById('sunrise');
const sunsetEl = document.getElementById('sunset');

const forecastList = document.getElementById('forecastList');
const unitToggle = document.getElementById('unitToggle');
const locBtn = document.getElementById('locBtn');

// State
let units = localStorage.getItem('weather_units') || 'metric'; // 'metric' or 'imperial'
let history = JSON.parse(localStorage.getItem('weather_history') || '[]');
let chart = null;
let currentWeather = null;
let forecastData = null;

// Utilities
function setStatus(txt){ statusEl.textContent = txt; }
function saveHistory(name){
  const n = name.trim();
  if(!n) return;
  history = history.filter(h => h.toLowerCase() !== n.toLowerCase());
  history.unshift(n);
  history = history.slice(0,6);
  localStorage.setItem('weather_history', JSON.stringify(history));
  renderSaved();
}
function renderSaved(){
  savedEl.innerHTML = '';
  history.forEach(h => {
    const btn = document.createElement('button');
    btn.textContent = h;
    btn.onclick = () => { cityInput.value = h; fetchAllByCity(h); };
    savedEl.appendChild(btn);
  });
  // bottom history
  historyRow.innerHTML = '';
  history.forEach(h => {
    const b = document.createElement('button');
    b.textContent = h;
    b.onclick = () => { cityInput.value = h; fetchAllByCity(h); };
    historyRow.appendChild(b);
  });
}
renderSaved();

function kelvinToC(k){ return k - 273.15; }
function cToF(c){ return (c*9)/5 + 32; }
function fmtTime(ts){ return new Date(ts*1000).toLocaleTimeString(); }

// Process forecast (3-hour entries -> daily summaries)
function processForecast(raw){
  const days = {};
  raw.list.forEach(item => {
    const d = new Date(item.dt*1000).toISOString().slice(0,10);
    days[d] = days[d]||[];
    days[d].push(item);
  });
  const keys = Object.keys(days).slice(0,5);
  const result = keys.map(key => {
    const entries = days[key];
    const temps = entries.map(e => e.main.temp);
    const avgTemp = temps.reduce((a,b)=>a+b,0)/temps.length;
    const wCount = {};
    entries.forEach(e => { const m = e.weather[0].main; wCount[m] = (wCount[m]||0)+1; });
    const main = Object.keys(wCount).reduce((a,b)=> wCount[a]>wCount[b]?a:b);
    // pick an icon from midday closest
    const mid = entries[Math.floor(entries.length/2)].weather[0].icon;
    return { date: key, avgTemp: Math.round(avgTemp*10)/10, main, icon: mid, raw: entries };
  });
  return result;
}

// Background gradient mapping
const THEMES = {
  Clear: ['#f6d365','#fda085'],
  Clouds: ['#d7d2cc','#304352'],
  Rain: ['#4e54c8','#8f94fb'],
  Drizzle: ['#4e54c8','#8f94fb'],
  Snow: ['#83a4d4','#b6fbff'],
  Thunderstorm: ['#232526','#414345'],
  Default: ['#89f7fe','#66a6ff']
};

function setBackground(condition){
  const colors = THEMES[condition] || THEMES.Default;
  document.body.style.background = `linear-gradient(120deg, ${colors[0]}, ${colors[1]})`;
}

// Chart
function renderChart(labels, data){
  const ctx = document.getElementById('tempChart').getContext('2d');
  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Avg temp', data, fill:false, tension:0.4, pointRadius:3, borderWidth:2 }]},
    options: { plugins:{legend:{display:false}}, scales:{y:{beginAtZero:false}} }
  });
}

// Render current weather
function renderCurrent(w){
  currentWeather = w;
  cityNameEl.textContent = `${w.name}, ${w.sys.country}`;
  descEl.textContent = (w.weather[0].description || '').toUpperCase();
  const t = Math.round(w.main.temp);
  const unitsSymbol = units==='metric'?'°C':'°F';
  tempEl.textContent = `${t}${unitsSymbol}`;
  feelsEl.textContent = `Feels like ${Math.round(w.main.feels_like)}${unitsSymbol}`;
  iconEl.src = `https://openweathermap.org/img/wn/${w.weather[0].icon}@2x.png`;
  humidityEl.textContent = `${w.main.humidity}%`;
  windEl.textContent = `${w.wind.speed} ${units==='metric'?'m/s':'mph'}`;
  pressureEl.textContent = `${w.main.pressure} hPa`;
  visibilityEl.textContent = `${(w.visibility/1000).toFixed(1)} km`;
  sunriseEl.textContent = `Sunrise ${fmtTime(w.sys.sunrise)}`;
  sunsetEl.textContent = `Sunset ${fmtTime(w.sys.sunset)}`;

  setBackground(w.weather[0].main);
  // animate current card in
  gsap.from('.card', {opacity:0,y:20,duration:0.8,stagger:0.08, ease:'power3.out'});
}

// Render forecast list
function renderForecast(forecast){
  forecastData = forecast;
  forecastList.innerHTML = '';
  const labels = [];
  const temps = [];
  forecast.forEach(day => {
    const item = document.createElement('div');
    item.className = 'forecastItem';
    const left = document.createElement('div'); left.className = 'left';
    const date = new Date(day.date);
    const dayLabel = date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
    left.innerHTML = `<div><strong>${dayLabel}</strong><div style="font-size:12px;opacity:0.85">${day.main}</div></div>`;
    const right = document.createElement('div'); right.className='right';
    const temp = Math.round(day.avgTemp);
    right.innerHTML = `<div style="text-align:right"><div style="font-weight:700">${temp}${units==='metric'?'°C':'°F'}</div><div style="font-size:12px;opacity:0.85">Avg</div></div>`;
    const img = document.createElement('img');
    img.src = `https://openweathermap.org/img/wn/${day.icon}@2x.png`;
    img.style.width='42px'; img.style.height='42px'; img.style.margin='0 10px';
    left.appendChild(img);
    item.appendChild(left);
    item.appendChild(right);
    forecastList.appendChild(item);

    labels.push(date.toLocaleDateString(undefined,{weekday:'short'}));
    temps.push(day.avgTemp);
  });
  renderChart(labels, temps);

  // small hover animations
  gsap.from('.forecastItem', {opacity:0, x:10, duration:0.6, stagger:0.08});
}

// Fetch utilities
async function fetchAllByCoords(lat, lon){
  setStatus('Loading weather for your location…');
  try{
    const [wRes, fRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=${units}`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=${units}`)
    ]);
    const wData = await wRes.json();
    const fData = await fRes.json();
    if(wData.cod && +wData.cod !== 200) throw new Error(wData.message || 'Weather error');
    if(fData.cod && fData.cod !== '200') throw new Error(fData.message || 'Forecast error');

    renderCurrent(wData);
    const proc = processForecast(fData);
    renderForecast(proc);
    setStatus('Loaded weather. ✓');
    saveHistory(wData.name);
  }catch(err){
    console.error(err);
    setStatus('Error: '+(err.message||'Failed to fetch'));
  }
}

async function fetchAllByCity(city){
  setStatus(`Searching "${city}"…`);
  try{
    const wRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=${units}`);
    const wData = await wRes.json();
    if(wData.cod && wData.cod !== 200) throw new Error(wData.message || 'City not found');

    // get forecast by coords
    const { coord: { lat, lon } } = wData;
    const fRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=${units}`);
    const fData = await fRes.json();
    if(fData.cod && fData.cod !== '200') throw new Error(fData.message || 'Forecast error');

    renderCurrent(wData);
    const proc = processForecast(fData);
    renderForecast(proc);
    setStatus('Loaded weather. ✓');
    saveHistory(wData.name);
  }catch(err){
    console.error(err);
    setStatus('Error: '+(err.message||'Failed to find city'));
  }
}

// Ask for location only when user clicks button
setStatus('Click "Use my location" or search a city to start.');


// Search handling + simple suggestions from history
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = cityInput.value.trim();
  if(!q) return;
  fetchAllByCity(q);
  suggestionsEl.classList.add('hidden');
});
cityInput.addEventListener('input', (e) => {
  const q = e.target.value.trim();
  if(!q){
    suggestionsEl.classList.add('hidden');
    return;
  }
  // show suggestion buttons: recent history + search current
  suggestionsEl.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.display = 'flex'; wrap.style.gap='8px'; wrap.style.flexWrap='wrap';
  history.slice(0,6).forEach(h=>{
    const b = document.createElement('button'); b.textContent=h; b.className='btn'; b.onclick=()=>{ cityInput.value=h; fetchAllByCity(h); suggestionsEl.classList.add('hidden'); };
    wrap.appendChild(b);
  });
  const searchNow = document.createElement('button'); searchNow.textContent=`Search "${q}"`; searchNow.className='btn primary';
  searchNow.onclick = ()=>{ fetchAllByCity(q); suggestionsEl.classList.add('hidden'); };
  wrap.appendChild(searchNow);
  suggestionsEl.appendChild(wrap);
  suggestionsEl.classList.remove('hidden');
});

// Units toggle
unitToggle.addEventListener('click', () => {
  units = units === 'metric' ? 'imperial' : 'metric';
  localStorage.setItem('weather_units', units);
  setStatus('Units set to ' + (units==='metric'?'°C':'°F') + ' — refreshing data...');
  // refresh current if present
  if(currentWeather){
    if(currentWeather.coord){
      fetchAllByCoords(currentWeather.coord.lat, currentWeather.coord.lon);
    } else if(currentWeather.name) {
      fetchAllByCity(currentWeather.name);
    }
  }
});

// use my location button
locBtn.addEventListener('click', () => {
  if(navigator.geolocation){
    setStatus('Detecting location…');
    navigator.geolocation.getCurrentPosition(p => {
      fetchAllByCoords(p.coords.latitude, p.coords.longitude);
    }, err => setStatus('Location error: ' + (err.message||'failed')), { timeout: 8000 });
  } else setStatus('Geolocation not available');
});

// small keyboard shortcut: Enter in input handled by form

// initial UI animations
gsap.from('.panel', {opacity:0,y:10,duration:0.7,stagger:0.08});
gsap.from('.topbar', {opacity:0,y:-6,duration:0.7});

// Render initial saved/his
renderSaved();




    


