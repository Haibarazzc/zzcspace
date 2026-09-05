import * as T from 'three'
import { landmarks } from './data'

type Point = [number, number, number]
type Instance = { matrix: T.Matrix4; color: T.Color }

// Thousands of tiles, lattice bars and stones are batched into a handful of draw calls.
export function buildCourtyard() {
  const group = new T.Group()
  const batches = new Map<string, Instance[]>()
  const stone = '#83918a', trim = '#b4b5a0', wood = '#512d23', red = '#943b25'
  const jade = ['#183b37','#23463e','#315043','#294239']
  const gold = ['#867044','#aa9052','#79683f','#9a8145']
  const materials = {
    matte: new T.MeshStandardMaterial({ roughness: .9 }),
    roof: new T.MeshStandardMaterial({ roughness: .48, metalness: .22 }),
    lamp: new T.MeshStandardMaterial({ color: '#ffc875', emissive: '#ffae4c', emissiveIntensity: 2.8, roughness: .7 }),
    water: new T.MeshStandardMaterial({ color: '#164b4d', roughness: .17, metalness: .65, transparent: true, opacity: .94 }),
  }
  const dummy = new T.Object3D()
  function box(pos: Point, size: Point, color: string, material = 'matte', rotation = 0) {
    dummy.position.set(...pos); dummy.scale.set(...size); dummy.rotation.set(0,rotation,0); dummy.updateMatrix()
    const list = batches.get(material) || []; list.push({matrix:dummy.matrix.clone(),color:new T.Color(color)}); batches.set(material,list)
  }
  function beam(a:Point,b:Point,width:number,color:string, material='roof') {
    const start=new T.Vector3(...a),end=new T.Vector3(...b),direction=end.clone().sub(start)
    dummy.position.copy(start.add(end).multiplyScalar(.5));dummy.scale.set(width,direction.length()+width*.3,width)
    dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());dummy.updateMatrix()
    const list=batches.get(material)||[];list.push({matrix:dummy.matrix.clone(),color:new T.Color(color)});batches.set(material,list)
  }
  function roof(x:number,y:number,z:number,w:number,d:number,h:number,golden=false) {
    const colors=golden?gold:jade, ridge=w*.25
    // Four curved hip surfaces, with upturned corners and individually laid tile runs.
    const point=(side:number,u:number,t:number):Point=>{
      const height=y+h*(1-Math.pow(t,.65))+.28*Math.pow(t,6)+.22*Math.pow(Math.abs(u),8)*t*t
      return side<2?[x+u*(ridge+(w/2-ridge)*t),height,z+(side===0?1:-1)*d/2*t]:[x+(side===2?1:-1)*(ridge+(w/2-ridge)*t),height,z+u*d/2*t]
    }
    for(let side=0;side<4;side++) {
      const positions:number[]=[],indices:number[]=[],cols=16,rows=10
      for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++)positions.push(...point(side,i/cols*2-1,j/rows))
      for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i;indices.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1)}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals()
      const mat=new T.MeshStandardMaterial({color:colors[0],roughness:.7,metalness:.15,side:T.DoubleSide})
      const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh)
      const runs=Math.ceil((side<2?w:d)/.18)
      for(let i=0;i<=runs;i++)for(let j=0;j<9;j++){
        const a=point(side,i/runs*2-1,j/9),b=point(side,i/runs*2-1,(j+1)/9);a[1]+=.045;b[1]+=.045
        beam(a,b,.068,colors[i%4])
      }
      for(let i=0;i<18;i++)beam(point(side,i/18*2-1,1),point(side,(i+1)/18*2-1,1),.13,colors[1])
    }
    box([x,y+h+.08,z],[ridge*2+.16,.18,.2],colors[1],'roof')
    for(const sign of [-1,1]){
      beam([x+sign*ridge,y+h+.1,z],[x+sign*(ridge+.4),y+h+.4,z],.14,colors[1])
      beam([x+sign*(ridge+.4),y+h+.4,z],[x+sign*(ridge+.49),y+h+.7,z],.12,colors[1])
      for(const zs of [-1,1]){
        const corner:Point=[x+sign*w/2,y+.5,z+zs*d/2]
        beam(corner,[corner[0]+sign*.24,corner[1]+.34,corner[2]+zs*.15],.12,colors[1])
      }
    }
  }
  function rail(x:number,y:number,z:number,w:number,axis='x') {
    const size:Point=axis==='x'?[w,.1,.1]:[.1,.1,w]
    box([x,y+.65,z],size,trim);box([x,y+.22,z],size,stone)
    for(let t=-w/2;t<=w/2+.01;t+=.5){const px=x+(axis==='x'?t:0),pz=z+(axis==='z'?t:0);box([px,y+.34,pz],[.09,.7,.09],trim);box([px,y+.76,pz],[.16,.12,.16],trim)}
  }
  function platform(x:number,z:number,w:number,d:number,y:number) {
    for(let i=0;i<3;i++)box([x,.65+i*y/3,z],[w-i*.18,y/3,d-i*.18],i===2?trim:stone)
    for(let i=0;i<6;i++)box([x,.55+i*y/6,z+d/2+.7-i*.15],[w*.42,.18,1.4-i*.15],trim)
  }
  function windows(x:number,y:number,z:number,w:number,h:number) {
    box([x,y,z],[w,h,.07],'#fff4d0','lamp')
    const count=Math.ceil(w/.17)
    for(let i=0;i<=count;i++)box([x-w/2+w*i/count,y,z+.06],[.034,h,.045],wood)
    for(let v=-h/2;v<=h/2;v+=.18)box([x,y+v,z+.07],[w,.027,.05],wood)
    box([x,y-h/2-.08,z+.04],[w+.1,.14,.13],wood)
  }
  function lantern(x:number,y:number,z:number,large=false) {
    const s=large?.24:.14
    box([x,y,z],[s,s*1.6,s],'#fff4d0','lamp')
    box([x,y+s*.95,z],[s*1.3,.065,s*1.3],wood)
    box([x,y-s*.95,z],[s*1.3,.065,s*1.3],wood)
    beam([x,y+s,z],[x,y+s*2,z],.035,'#b08e48')
  }
  function hall(x:number,z:number,w:number,d:number,h:number,golden=false) {
    platform(x,z,w+.6,d+.5,.65)
    const floor=1.35, wallH=h*.44, wallW=w*.81, wallD=d*.75
    box([x,floor+wallH/2,z],[wallW,wallH,wallD],wood)
    // Wall panels face the court; deep red columns remain visible under the eaves.
    for(let i=-2;i<=2;i++)if(i!==0)windows(x+i*wallW/5,floor+wallH*.55,z+wallD/2+.03,wallW/5*.76,wallH*.72)
    box([x,floor+wallH*.42,z+wallD/2+.04],[wallW*.14,wallH*.84,.08],'#211d18')
    for(const side of [-1,1])for(let i=-2;i<=2;i++){
      const px=x+i*wallW/4,pz=z+side*(wallD/2+.16)
      box([px,floor+wallH/2,pz],[.17,wallH+.1,.17],red)
      box([px,floor+.05,pz],[.29,.14,.29],trim)
      for(let j=0;j<3;j++)box([px,floor+wallH-.1+j*.11,pz],[.25+j*.2,.1,.27+j*.14],j%2?gold[0]:red)
    }
    for(const side of [-1,1]){box([x,floor+wallH-.1,z+side*(wallD/2+.15)],[wallW+.5,.22,.22],red);lantern(x-side*wallW*.36,floor+wallH-.38,z+wallD/2+.32)}
    roof(x,floor+wallH,z,w,d,h*.3,golden)
    rail(x-w*.34,1.03,z+d*.49,w*.25);rail(x+w*.34,1.03,z+d*.49,w*.25)
    rail(x-w*.49,1.03,z,d*.9,'z');rail(x+w*.49,1.03,z,d*.9,'z')
    if(golden){
      const upper=floor+wallH+h*.25
      box([x,upper+.43,z],[w*.66,.85,d*.53],wood)
      for(let i=-3;i<=3;i++)windows(x+i*.86,upper+.43,z+d*.265+.02,.5,.45)
      roof(x,upper+.8,z,w*.94,d*.9,h*.25,true)
      // Plaque lettering is drawn onto a real mesh, not an HTML overlay.
      const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!
      ctx.fillStyle='#20312c';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#b4a06b';ctx.lineWidth=10;ctx.strokeRect(8,8,496,112);ctx.fillStyle='#e1c88b';ctx.textAlign='center';ctx.font='70px SimSun, serif';ctx.fillText('星 晖 殿',256,89)
      const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace
      const plaque=new T.Mesh(new T.PlaneGeometry(2.2,.55),new T.MeshStandardMaterial({map:tex,roughness:.8}));plaque.position.set(x,floor+wallH-.1,z+wallD/2+.3);group.add(plaque)
    }
  }
  function pagoda(x:number,z:number) {
    platform(x,z,4.3,4.3,.7)
    for(let level=0;level<5;level++){
      const w=3.5-level*.35,y=1.4+level*1.85
      box([x,y+.5,z],[w*.7,1.15,w*.7],wood)
      for(const s of [-1,1]){
        windows(x+s*w*.19,y+.55,z+w*.35+.04,w*.19,.6)
        box([x+s*w*.35,y+.55,z+w*.35],[.13,1.2,.13],red)
        lantern(x+s*w*.22,y+.5,z+w*.4)
      }
      roof(x,y+1.05,z,w+1,w+1,.95)
    }
    beam([x,10.9,z],[x,12.4,z],.15,'#b3a06a')
    for(let i=0;i<5;i++)box([x,11.4+i*.2,z],[.5-i*.06,.09,.5-i*.06],gold[1],'roof')
  }
  function pavilion() {
    const x=0,z=2.4
    platform(x,z,4.1,4.1,.7)
    for(const xs of [-1,1])for(const zs of [-1,1]){box([xs*1.4,2.5,z+zs*1.4],[.18,2.8,.18],red);lantern(xs*1.32,3.15,z+zs*1.32,true)}
    box([0,3.65,z],[3.3,.22,3.3],red);roof(0,3.75,z,4.8,4.8,1.5,true)
    rail(-1.85,1.05,z,3.6,'z');rail(1.85,1.05,z,3.6,'z');rail(0,1.05,z-1.85,3.6)
  }
  function tree(x:number,z:number,seed:number,ginkgo=false) {
    const rnd=(n:number)=>{const v=Math.sin(seed*18.7+n*83.23)*43758.5453;return v-Math.floor(v)}
    const height=2.6+rnd(1)*1.6
    box([x,.6+height/2,z],[.25,height,.25],'#4a4533')
    for(let i=0;i<13;i++){
      const angle=rnd(i+3)*Math.PI*2,radius=rnd(i+22)*1.15
      const px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius,py=.8+height-rnd(i+80)*1.1
      if(i%4===0)beam([x,1.4,z],[px,py,pz],.15,'#504a32','matte')
      box([px,py,pz],[.6+rnd(i+42)*1.15,.24+rnd(i+64)*.45,.6+rnd(i+73)*1.05],ginkgo?['#838148','#a79a54','#c3ac62','#697043'][i%4]:['#244d3c','#38664b','#466e4e','#385d3e'][i%4])
    }
  }
  // Raised miniature landscape with masonry courses, walkways and two lotus pools.
  box([0,-.3,0],[27.5,1.5,28],'#243931');box([0,.42,0],[27.8,.2,28.3],'#56665a')
  box([0,.57,0],[26.9,.12,27.4],'#344b3a')
  for(let row=0;row<16;row++)for(let col=0;col<15;col++){
    const x=(col-7)*1.5,z=(row-7.5)*1.5
    box([x,.66,z],[1.46,.1,1.46],['#64736b','#737d70','#778073','#606f68'][(row*11+col*7)%4])
  }
  box([0,.68,4.8],[3.6,.1,15],'#929785')
  for(const s of [-1,1]){
    // Perimeter garden bands and walls.
    box([s*12.65,1.06,0],[.38,.85,26.8],'#788478');box([s*12.65,1.55,0],[.64,.17,26.8],jade[1],'roof')
    for(let z=-12;z<13;z+=1.4){box([s*12.65,1.3,z],[.6,1.15,.5],stone);box([s*12.65,1.93,z],[.74,.14,.64],jade[0],'roof')}
    box([s*8.3,.74,10.4],[6,.14,3.4],trim)
    box([s*8.3,.83,10.4],[5.65,.13,3.05],'#062a2b')
    box([s*8.3,.91,10.4],[5.5,.045,2.9],'#ffffff','water')
    for(let i=0;i<20;i++){
      const px=s*8.3+Math.sin(i*14.3)*2.4,pz=10.4+Math.cos(i*6.6)*1.2
      box([px,.945,pz],[.2,.025,.19],i%3?'#496b4d':'#6f8151', 'matte',i)
      if(i%6===0)box([px,.99,pz],[.09,.07,.09],'#c39583')
    }
    for(let i=0;i<9;i++)tree(s*(i%2?11.2:5.2),-11.3+i*2.6,i+30+(s+1)*11,i%3!==0)
    for(const z of [-3.1,5.8,9.1]){box([s*3.3,1.02,z],[.35,.75,.35],stone);lantern(s*3.3,1.73,z,true)}
    // Gate wall stops before the entrance.
    box([s*9.3,1.15,13],[7.1,1.05,.4],stone);box([s*9.3,1.75,13],[7.2,.18,.63],jade[1],'roof')
  }
  box([0,1.05,-13],[25.4,.8,.4],stone);box([0,1.53,-13],[25.8,.17,.64],jade[1],'roof')
  for(let i=0;i<7;i++)box([0,-.6+i*.18,14.4-i*.2],[6.6,.18,2.6-i*.2],stone)
  hall(0,-5.8,10.8,7.2,9.1,true);pavilion();pagoda(-8.7,-8.3);pagoda(8.7,-8.3)
  hall(-8.1,-.8,5.1,4.5,4.4);hall(8.1,-.8,5.1,4.5,4.4);hall(-8.1,6,5,3.8,3.8);hall(8.1,6,5,3.8,3.8)
  // Three open portals, topped by a tiled gate roof.
  for(const x of [-4.6,-1.65,1.65,4.6]){box([x,2.05,10],[.55,2.9,1.9],wood);box([x,3.5,10],[.75,.24,2.2],red)}
  box([0,3.48,10],[9.8,.34,2.1],red);roof(0,3.7,10,10.6,3.1,1.0)
  for(const x of [-4,-2.25,2.25,4])lantern(x,2.7,11,true)
  // Narrow covered corridors link the northern precincts.
  for(const s of [-1,1]){for(let z=-10;z<-2;z+=1.4)box([s*5.65,1.7,z],[.14,2,.14],red);roof(s*5.65,2.8,-6.5,1.8,8.4,.6)}
  for(const [key,instances] of batches){
    const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),materials[key as keyof typeof materials],instances.length)
    instances.forEach((v,i)=>{mesh.setMatrixAt(i,v.matrix);if(key==='matte'||key==='roof')mesh.setColorAt(i,v.color)})
    mesh.castShadow=key==='matte'||key==='roof';mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh)
  }
  group.userData.landmarks=landmarks
  return { group, materials }
}
