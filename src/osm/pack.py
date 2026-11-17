# Pack the OSM Istanbul footprints into gzip'd binary blocks on a 2 km cell grid.
# block file ob_{bx}_{bz}.dat = gzip( header + cells ); see the reader in the game (OSMB) for the layout.
import json,glob,math,struct,gzip,os,sys,random
LAT0,LON0=41.07,29.00;MX=111320*math.cos(math.radians(LAT0));MZ=111320
def ll(lat,lon):return ((lon-LON0)*MX,-(lat-LAT0)*MZ)
X0,Z0=ll(41.3,28.45);X1,Z1=ll(40.8,29.45);CELL=2000;BLK=8
NX=math.ceil((X1-X0)/CELL);NZ=math.ceil((Z1-Z0)/CELL)
OLD=ll(41.0125,28.968)
def h32(*a):
    v=2166136261
    for x in a:
        v=((v^(int(x)&0xffffffff))*16777619)&0xffffffff
    return v/4294967296
def area(r):
    return 0.5*sum(r[i][0]*r[(i+1)%len(r)][1]-r[(i+1)%len(r)][0]*r[i][1] for i in range(len(r)))
def dp(pts,tol):
    if len(pts)<3:return pts
    a,b=pts[0],pts[-1];dx,dz=b[0]-a[0],b[1]-a[1];L=math.hypot(dx,dz) or 1e-9
    md,mi=0,0
    for i in range(1,len(pts)-1):
        d=abs((pts[i][0]-a[0])*dz-(pts[i][1]-a[1])*dx)/L
        if d>md:md,mi=d,i
    if md>tol:return dp(pts[:mi+1],tol)[:-1]+dp(pts[mi:],tol)
    return [a,b]
def simp_ring(r,tol):
    if len(r)<=4:return r
    # split at the farthest point from r[0] so the ring is two open chains
    far=max(range(len(r)),key=lambda i:(r[i][0]-r[0][0])**2+(r[i][1]-r[0][1])**2)
    c1=dp(r[:far+1],tol);c2=dp(r[far:]+[r[0]],tol)
    out=c1[:-1]+c2[:-1]
    return out if len(out)>=3 else r
WALL=[(233,225,207),(238,238,234),(212,212,208),(217,199,168),(232,217,160),(217,166,140),(185,198,207),(207,168,110),(181,170,154),(227,195,189),(201,210,176),(224,214,196)]
ROOF=[(180,97,63),(143,74,51),(142,143,140),(169,169,163),(109,111,112),(123,133,140),(156,143,128),(196,190,178)]
LOW={'shed','garage','garages','greenhouse','roof','hut','kiosk','carport','service','construction','container'}
IND={'industrial','warehouse','retail','commercial','supermarket','hangar','factory','manufacture'}
TALLT={'school','hospital','university','college','public','government','office','hotel','dormitory','train_station','civic'}
HOUSE={'house','detached','semidetached_','terrace','bungalow','farm','villa'}
cells={}
def cell_of(x,z):
    i=int((x-X0)//CELL);j=int((z-Z0)//CELL)
    if 0<=i<NX and 0<=j<NZ:return i,j
    return None
def add(x,z,rec,far):
    c=cell_of(x,z)
    if not c:return
    d=cells.setdefault(c,{'far':[],'near':[],'trees':[]})
    d['far' if far else 'near'].append(rec)
nb=0
for f in sorted(glob.glob(os.path.join(sys.argv[1],'bl_*.json'))):
    D=json.load(open(f));ox,oz=D['ox'],D['oz']
    def ring(flat):
        r=[(ox+flat[i],oz+flat[i+1]) for i in range(0,len(flat),2)]
        if len(r)>1 and abs(r[0][0]-r[-1][0])<0.05 and abs(r[0][1]-r[-1][1])<0.05:r=r[:-1]
        return r
    for h,flat,t in D['b']:
        r=ring(flat)
        if len(r)<3:continue
        A=abs(area(r))
        if A<22:continue
        r=simp_ring(r,0.7)
        if len(r)>200:r=simp_ring(r,2.5)
        if len(r)<3 or len(r)>250:continue
        cx=sum(p[0] for p in r)/len(r);cz=sum(p[1] for p in r)/len(r)
        u=h32(cx*10,cz*10);old=math.hypot(cx-OLD[0],cz-OLD[1])<2600
        typ=0
        if t=='mosque':typ=2
        elif t in IND or (t=='yes' and A>4000):typ=3
        if not h:
            if t in LOW:h=3+u*3
            elif typ==2:h=10+u*5
            elif typ==3:h=7+u*8
            elif t in HOUSE:h=6+u*3.5
            elif t in TALLT:h=12+u*12
            elif t in('apartments','residential','flats'):h=(5+int(u*4))*3.1
            elif A<70:h=(1+int(u*3))*3.1
            elif A<400:h=(3+int(u*5))*3.1
            else:h=(4+int(u*7))*3.1
            if old and h>16:h=12+u*5
        h=max(2.5,min(h,420))
        wc=int(h32(cx,cz,7)*len(WALL))
        if typ==3:wc=[2,6,8][int(u*3)]
        if typ==2:wc=1
        if t in HOUSE or (h<10 and u<0.5) or (old and u<0.7):rc=int(h32(cz,1)*2)
        else:rc=2+int(h32(cz,cx,3)*5)
        if typ==2:rc=5
        far=A>450 or h>=22 or typ==2
        add(cx,cz,(typ,h,wc,rc,r),far);nb+=1
    for kind,flat in D['p']:
        r=ring(flat)
        if len(r)<3:continue
        if kind=='stadium':
            r=simp_ring(r,2.0)
            if len(r)<3:continue
            cx=sum(p[0] for p in r)/len(r);cz=sum(p[1] for p in r)/len(r);A=abs(area(r))
            if A<6000:continue
            add(cx,cz,(4,24,1,3,r),True);continue
        if kind not in('park','garden'):continue
        A=abs(area(r))
        if A<400:continue
        xs=[p[0] for p in r];zs=[p[1] for p in r];sp=11.0
        n=0
        x=min(xs)
        while x<max(xs):
            z=min(zs)
            while z<max(zs):
                jx=x+(h32(x,z,1)-0.5)*sp*0.8;jz=z+(h32(x,z,2)-0.5)*sp*0.8
                inside=False;j=len(r)-1
                for i in range(len(r)):
                    if (r[i][1]>jz)!=(r[j][1]>jz) and jx<(r[j][0]-r[i][0])*(jz-r[i][1])/(r[j][1]-r[i][1])+r[i][0]:inside=not inside
                    j=i
                if inside and h32(jx,jz,5)<0.72:
                    c=cell_of(jx,jz)
                    if c:cells.setdefault(c,{'far':[],'near':[],'trees':[]})['trees'].append((jx,jz,int(h32(jx,jz,9)*255)))
                    n+=1
                z+=sp
            x+=sp
    for name,kind,flat in D['h']:
        if kind not in('citywalls','aqueduct','city_wall'):continue
        r=[(ox+flat[i],oz+flat[i+1]) for i in range(0,len(flat),2)]
        r=dp(r,1.0)
        if len(r)<2:continue
        h=22 if kind=='aqueduct' else 12
        cx=sum(p[0] for p in r)/len(r);cz=sum(p[1] for p in r)/len(r)
        add(cx,cz,(5 if kind!='aqueduct' else 6,h,8,6,r),True)
print('buildings',nb,'cells',len(cells),'grid',NX,NZ)
# write blocks
os.makedirs(sys.argv[2],exist_ok=True);tot=0;meta=[]
TREECAP=7000
for bx in range(math.ceil(NX/BLK)):
    for bz in range(math.ceil(NZ/BLK)):
        cl=[(c,cells[c]) for c in sorted(cells) if c[0]//BLK==bx and c[1]//BLK==bz]
        if not cl:continue
        body=bytearray();hdr=bytearray()
        for (i,j),d in cl:
            ccx=X0+(i+0.5)*CELL;ccz=Z0+(j+0.5)*CELL
            recs=d['far']+d['near']
            trees=d['trees']
            if len(trees)>TREECAP:random.Random(i*999+j).shuffle(trees);trees=trees[:TREECAP]
            hdr+=struct.pack('<HHIIII',i,j,len(d['far']),len(recs),len(trees),len(body))
            for typ,h,wc,rc,r in recs:
                body+=struct.pack('<BBHBB',typ,0,int(round(h*10)),wc,rc)
                body+=struct.pack('<H',len(r))
                body+=b''.join(struct.pack('<hh',max(-32767,min(32767,int(round((p[0]-ccx)*10)))),max(-32767,min(32767,int(round((p[1]-ccz)*10))))) for p in r)
            for x,z,s in trees:
                body+=struct.pack('<hhB',int(round((x-ccx)*10)),int(round((z-ccz)*10)),s)
        raw=struct.pack('<IH',0x4253534f,len(cl))+hdr+body
        gz=gzip.compress(bytes(raw),9);fn=f'ob_{bx}_{bz}.dat'
        open(os.path.join(sys.argv[2],fn),'wb').write(gz);tot+=len(gz);meta.append((bx,bz,len(cl),len(raw),len(gz)))
for m in meta:print(m)
print('total gz MB',tot/1e6,'X0Z0',round(X0,1),round(Z0,1),'NX NZ',NX,NZ)
