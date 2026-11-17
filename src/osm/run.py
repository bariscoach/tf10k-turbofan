import json,math,os,subprocess,time,re,sys
LAT0,LON0=41.07,29.00;MX=111320*math.cos(math.radians(LAT0));MZ=111320
def ll2w(lat,lon):return ((lon-LON0)*MX,-(lat-LAT0)*MZ)
OUT='/Users/barishiz/Desktop/tf10k-turbofan/assets'
ASSETS='../assets'
def hval(t):
    h=t.get('height')
    if h:
        m=re.match(r'([\d.]+)',h)
        if m:return float(m.group(1))
    lv=t.get('building:levels')
    if lv:
        m=re.match(r'([\d.]+)',lv)
        if m:return float(m.group(1))*3.2
    return None
def fetch(lat0,lon0,lat1,lon1,fn):
    q=f'''[out:json][timeout:280];
(
  way["building"]["building"!="no"]({lat0},{lon0},{lat1},{lon1});
  way["leisure"~"^(park|garden|stadium|pitch|recreation_ground)$"]({lat0},{lon0},{lat1},{lon1});
  way["historic"]({lat0},{lon0},{lat1},{lon1});
  way["amenity"~"^(place_of_worship)$"]["building"]({lat0},{lon0},{lat1},{lon1});
);
out geom;'''
    open('q_tmp.txt','w').write(q)
    for t in range(6):
        code=subprocess.run(['curl','-s','-m','300','-A','RedAppleGame/1.0 (hobby flight game)','-o',fn,'-w','%{http_code}','--data-urlencode','data@q_tmp.txt','https://overpass-api.de/api/interpreter'],capture_output=True,text=True).stdout.strip()
        if code=='200':return True
        time.sleep(25)
    return False
def compact(fn,lat0,lon0,out):
    d=json.load(open(fn));ox,oz=ll2w(lat0,lon0)
    B=[];P=[];H=[]
    for e in d.get('elements',[]):
        g=e.get('geometry');t=e.get('tags',{})
        if not g or len(g)<3:continue
        flat=[]
        for p in g:
            x,z=ll2w(p['lat'],p['lon']);flat+=[round(x-ox,1),round(z-oz,1)]
        if 'building' in t:
            B.append([hval(t) or 0, flat, t.get('building','yes')[:12]])
        elif 'historic' in t:
            H.append([t.get('name','')[:40], t.get('historic','')[:20], flat])
        else:
            P.append([t.get('leisure',t.get('name',''))[:12], flat])
    json.dump({'ox':round(ox,1),'oz':round(oz,1),'b':B,'p':P,'h':H},open(out,'w'),separators=(',',':'))
    return len(B),len(P),len(H)
rows=[40.80+0.1*k for k in range(5)];cols=[28.45+0.1*k for k in range(10)]
chunks=[(r,c) for r in range(5) for c in range(10)]
log=open('run.log','a')
for r,c in chunks:
    la0,lo0=rows[r],cols[c];la1,lo1=la0+0.1,lo0+0.1
    raw=f'raw_{r}_{c}.json';out=os.path.join(ASSETS,f'bl_{r}{c}.json')
    if os.path.exists(out):continue
    ok=fetch(la0,lo0,la1,lo1,raw)
    if not ok:print('FAIL',r,c,file=log,flush=True);continue
    n=compact(raw,la1,lo0,out)   # origin = north-west corner
    os.remove(raw);print('ok',r,c,n,os.path.getsize(out),file=log,flush=True)
print('ALLDONE',file=log,flush=True)
