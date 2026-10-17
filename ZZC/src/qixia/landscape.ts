import * as T from 'three'
import { blossomRandom, createPetalGeometry } from './model'
import { buildCherryGrove } from './grove'

const peaks=[[-45,-34,17,20],[-17,-59,24,18],[20,-61,21,20],[52,-29,22,22],[-59,13,19,22],[59,27,18,24],[-40,65,22,25],[27,76,23,24],[-49,-91,29,24],[54,-93,31,26]]
const streamX=(z:number)=>23+Math.sin(z*.058)*4+Math.sin(z*.12)*1.4
const pathX=(z:number)=>Math.sin((z-15)*.075)*2.4+(z-15)*.055

function groundHeight(x:number,z:number) {
  const distance=Math.hypot(x,z*.9),rise=T.MathUtils.smoothstep(distance,19,38)
  let height=0
  for(const [px,pz,top,width] of peaks)height+=top*Math.exp(-((x-px)**2+(z-pz)**2)/(width*width))
  const ridges=Math.sin(x*.19+Math.sin(z*.11))*Math.cos(z*.16)+Math.sin(x*.43+z*.27)*.38
  height=(height+ridges*2.2)*rise-.16
  height*=1-.97*Math.exp(-((x-streamX(z))**2)/64)
  // The courtyard's front steps settle into a lower, gently winding approach.
  if(z>13&&z<24)height-=.68*Math.exp(-x*x/38)*Math.sin((z-13)/11*Math.PI)
  const channel=Math.exp(-(((x-streamX(z))/3.1)**4))
  return T.MathUtils.lerp(height,-1.12,channel)
}

export function buildLandscape() {
  const group=new T.Group();group.name='mountain-valley'
  const terrain=new T.PlaneGeometry(230,230,300,300);terrain.rotateX(-Math.PI/2)
  const positions=terrain.getAttribute('position'),colors:number[]=[]
  for(let i=0;i<positions.count;i++)positions.setY(i,groundHeight(positions.getX(i),positions.getZ(i)))
  terrain.computeVertexNormals()
  const normals=terrain.getAttribute('normal')
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i),height=positions.getY(i)
    const variation=(Math.sin(x*.4)*Math.cos(z*.31)+1)*.5
    const color=new T.Color('#2c493b').lerp(new T.Color('#607858'),variation*.45+T.MathUtils.clamp(height/80,0,.3))
    color.lerp(new T.Color('#81817d'),T.MathUtils.smoothstep(1-normals.getY(i),.18,.54)*.7)
    if(Math.abs(x-streamX(z))<3.8)color.lerp(new T.Color('#969e91'),.35)
    if(z>15&&z<80)color.lerp(new T.Color('#b2a592'),1-T.MathUtils.smoothstep(Math.abs(x-pathX(z)),.9,1.85))
    colors.push(color.r,color.g,color.b)
  }
  terrain.setAttribute('color',new T.Float32BufferAttribute(colors,3))
  const land=new T.Mesh(terrain,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));land.name='continuous-valley-ground';land.receiveShadow=true;group.add(land)

  const waterPositions:number[]=[],indices:number[]=[]
  for(let i=0;i<=150;i++){
    const z=-95+i*1.3,width=1.48+Math.sin(z*.055)*.22,x=streamX(z)
    waterPositions.push(x-width,-.76,z,x+width,-.76,z)
    if(i<150){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3)}
  }
  const riverGeometry=new T.BufferGeometry();riverGeometry.setAttribute('position',new T.Float32BufferAttribute(waterPositions,3));riverGeometry.setIndex(indices);riverGeometry.computeVertexNormals()
  const river=new T.Mesh(riverGeometry,new T.MeshStandardMaterial({color:'#708e9a',metalness:.22,roughness:.23}));river.name='valley-stream';river.receiveShadow=true;group.add(river)

  const ripplePositions:number[]=[]
  for(let i=0;i<270;i++){
    const z=-90+blossomRandom(i+7000)*182,x=streamX(z)+(blossomRandom(i+7001)-.5)*1.7,span=.12+blossomRandom(i+7002)*.6
    ripplePositions.push(x-span,-.748,z,x+span,-.748,z+.025)
  }
  const ripples=new T.BufferGeometry();ripples.setAttribute('position',new T.Float32BufferAttribute(ripplePositions,3))
  const highlights=new T.LineSegments(ripples,new T.LineBasicMaterial({color:'#c9dbe0',transparent:true,opacity:.24}));group.add(highlights)

  // Small meadow tufts join the terrace edge to the larger wooded slopes.
  const blades:number[]=[]
  for(let i=0;i<5;i++){
    const angle=i*2.399,dx=Math.cos(angle),dz=Math.sin(angle)
    blades.push(-dz*.08,0,dx*.08,dz*.08,0,-dx*.08,dx*.35,.5+(i%3)*.1,dz*.35)
  }
  const grassGeometry=new T.BufferGeometry();grassGeometry.setAttribute('position',new T.Float32BufferAttribute(blades,3));grassGeometry.computeVertexNormals()
  const tufts:T.Matrix4[]=[],tuftColors:T.Color[]=[],plant=new T.Object3D()
  for(let i=0;i<4200;i++){
    const angle=blossomRandom(i+8800)*Math.PI*2,radius=15+blossomRandom(i+9900)*31,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius
    if(Math.abs(x)<14.4&&Math.abs(z)<15||Math.abs(x-streamX(z))<3.8||z>14&&Math.abs(x-pathX(z))<2.2)continue
    const scale=.2+blossomRandom(i+3300)*.5
    plant.position.set(x,groundHeight(x,z)-.04,z);plant.rotation.y=angle;plant.scale.setScalar(scale);plant.updateMatrix();tufts.push(plant.matrix.clone());tuftColors.push(new T.Color(i%3?'#496044':'#758160'))
  }
  const meadow=new T.InstancedMesh(grassGeometry,new T.MeshStandardMaterial({side:T.DoubleSide,roughness:1}),tufts.length)
  tufts.forEach((matrix,i)=>{meadow.setMatrixAt(i,matrix);meadow.setColorAt(i,tuftColors[i])});meadow.name='valley-meadow';meadow.receiveShadow=true;meadow.computeBoundingSphere();group.add(meadow)

  // Cherry blossom woodland follows the slopes, leaving the stream and approach open.
  const trees=[]
  for(let i=0;i<1350;i++){
    const angle=blossomRandom(i+930)*Math.PI*2,radius=24+blossomRandom(i+1720)*79
    const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius
    if(Math.abs(x-streamX(z))<4.2||z>15&&Math.abs(x-pathX(z))<3.5)continue
    // Keep the bridge corridor open so the crossing stays in view.
    if(Math.abs(z+8)<3.6&&x>13&&x<37)continue
    trees.push({x,y:groundHeight(x,z),z,scale:.72+blossomRandom(i+1240)*.4,seed:i+930})
  }
  group.add(buildCherryGrove(trees))

  const dummy=new T.Object3D()
  const rocks=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({roughness:1}),170)
  for(let i=0;i<170;i++){
    const z=-45+blossomRandom(i+312)*110,x=streamX(z)+(i%2?1:-1)*(2.2+blossomRandom(i+311)*1.5),size=.2+blossomRandom(i+841)*.65
    dummy.position.set(x,groundHeight(x,z)+size*.22,z);dummy.scale.set(size,size*.6,size*.8);dummy.rotation.set(i*.1,i,0);dummy.updateMatrix()
    rocks.setMatrixAt(i,dummy.matrix);rocks.setColorAt(i,new T.Color(i%3?'#8e9189':'#757e7d'))
  }
  rocks.name='stream-bank-stones';rocks.receiveShadow=true;rocks.computeBoundingSphere();group.add(rocks)

  // Rushes and reeds gather in the shallows, softening the channel's cut edge.
  const reedBlades:number[]=[]
  for(let i=0;i<6;i++){
    const angle=i*2.399,dx=Math.cos(angle),dz=Math.sin(angle)
    reedBlades.push(-dz*.06,0,dx*.06,dz*.06,0,-dx*.06,dx*.18,.8+(i%3)*.16,dz*.18)
  }
  const reedGeometry=new T.BufferGeometry();reedGeometry.setAttribute('position',new T.Float32BufferAttribute(reedBlades,3));reedGeometry.computeVertexNormals()
  const reedStems:T.Matrix4[]=[],reedColors:T.Color[]=[],reed=new T.Object3D()
  for(let i=0;i<900;i++){
    const z=-78+blossomRandom(i+4200)*156,side=i%2?1:-1
    const x=streamX(z)+side*(2.5+blossomRandom(i+4300)*1.7),y=groundHeight(x,z)
    if(y>-0.1||y<-0.82)continue
    reed.position.set(x,y-.02,z);reed.rotation.y=blossomRandom(i+4400)*Math.PI*2
    reed.scale.setScalar(1+blossomRandom(i+4500)*.7);reed.updateMatrix()
    reedStems.push(reed.matrix.clone());reedColors.push(new T.Color(i%3?'#57684a':'#6a7650'))
  }
  const reeds=new T.InstancedMesh(reedGeometry,new T.MeshStandardMaterial({side:T.DoubleSide,roughness:1}),reedStems.length)
  reedStems.forEach((matrix,i)=>{reeds.setMatrixAt(i,matrix);reeds.setColorAt(i,reedColors[i])})
  reeds.name='stream-bank-reeds';reeds.receiveShadow=true;reeds.computeBoundingSphere();group.add(reeds)

  // Fallen petals rest on the current instead of vanishing into the water colour.
  const petalGeometry=createPetalGeometry(3),floaters:T.Matrix4[]=[],floaterColors:T.Color[]=[],floater=new T.Object3D()
  for(let i=0;i<150;i++){
    const z=-85+blossomRandom(i+5100)*170,width=1.48+Math.sin(z*.055)*.22
    floater.position.set(streamX(z)+(blossomRandom(i+5200)-.5)*width*1.4,-.742,z)
    floater.rotation.set(-Math.PI/2,0,blossomRandom(i+5300)*Math.PI*2)
    floater.scale.setScalar(.09+blossomRandom(i+5400)*.06);floater.updateMatrix()
    floaters.push(floater.matrix.clone());floaterColors.push(new T.Color(i%3?'#ffd8e9':'#fff1f0'))
  }
  const petals=new T.InstancedMesh(petalGeometry,new T.MeshStandardMaterial({side:T.DoubleSide,roughness:.8,emissive:'#d69cb6',emissiveIntensity:.18}),floaters.length)
  floaters.forEach((matrix,i)=>{petals.setMatrixAt(i,matrix);petals.setColorAt(i,floaterColors[i])})
  petals.name='stream-floating-petals';petals.computeBoundingSphere();group.add(petals)

  // A small stone arch bridge crosses the stream, so the far bank reads as a
  // reachable garden instead of a cut-off strip of rocks. One instanced batch.
  const bridgeX=streamX(-8),bridgeZ=-8,bridgeSpan=8
  const deckY=(t:number)=>.06+Math.sin(Math.PI*t)*.72
  const stoneLight='#b4aba2',stoneMid='#968d86',stoneDark='#847c75'
  const bridgeParts:T.Matrix4[]=[],bridgeColors:T.Color[]=[],bridge=new T.Object3D()
  const place=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{
    bridge.position.set(x,y,z);bridge.rotation.set(0,0,0);bridge.scale.set(w,h,d);bridge.updateMatrix()
    bridgeParts.push(bridge.matrix.clone());bridgeColors.push(new T.Color(color))
  }
  const segments=13
  for(let i=0;i<segments;i++){
    const t=(i+.5)/segments,x=bridgeX-bridgeSpan/2+bridgeSpan*t,y=deckY(t)
    place(x,y,bridgeZ,bridgeSpan/segments+.05,.2,2.45,i%2?stoneLight:stoneMid)
    for(const side of [-1,1]){
      place(x,y+.54,bridgeZ+side*1.14,bridgeSpan/segments+.03,.12,.14,stoneMid)
      place(x,y+.3,bridgeZ+side*1.14,.12,.5,.12,stoneDark)
    }
  }
  for(const t of [1/3,2/3]){
    const x=bridgeX-bridgeSpan/2+bridgeSpan*t,top=deckY(t)-.05
    place(x,(top-.95)/2-.95/2+.475,bridgeZ,1.0,top+.85,2.1,stoneMid)
  }
  for(const end of [-1,1]){
    const x=bridgeX+end*(bridgeSpan/2-.5)
    place(x,-.42,bridgeZ,1.35,1.55,3.1,stoneDark)
    place(x,.34,bridgeZ,1.5,.15,3.25,stoneLight)
  }
  const bridgeMesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({roughness:.92}),bridgeParts.length)
  bridgeParts.forEach((matrix,i)=>{bridgeMesh.setMatrixAt(i,matrix);bridgeMesh.setColorAt(i,bridgeColors[i])})
  bridgeMesh.name='stream-stone-bridge';bridgeMesh.castShadow=true;bridgeMesh.receiveShadow=true;bridgeMesh.computeBoundingSphere();group.add(bridgeMesh)

  return group
}
