import * as T from 'three'
import { blossomRandom } from './model'

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

  // Distant evergreen silhouettes provide scale without competing with the courtyard blossoms.
  const foliage:T.Matrix4[]=[],trunks:T.Matrix4[]=[],forestColors:T.Color[]=[],dummy=new T.Object3D()
  for(let i=0;i<2100;i++){
    const angle=blossomRandom(i+930)*Math.PI*2,radius=27+blossomRandom(i+1720)*68
    const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius
    if(Math.abs(x-streamX(z))<4||z>15&&Math.abs(x-pathX(z))<3)continue
    const y=groundHeight(x,z),height=1.1+blossomRandom(i+1240)*1.65
    dummy.position.set(x,y+height*.38,z);dummy.scale.set(.12,height*.76,.12);dummy.rotation.set(0,angle,0);dummy.updateMatrix();trunks.push(dummy.matrix.clone())
    for(let tier=0;tier<3;tier++){
      const width=height*(.27-tier*.055)
      dummy.position.set(x,y+height*(.43+tier*.19),z);dummy.scale.set(width,height*.52,width);dummy.updateMatrix();foliage.push(dummy.matrix.clone())
      forestColors.push(new T.Color(['#344e43','#3d5748','#506451','#425c51'][i%4]))
    }
  }
  const forest=new T.InstancedMesh(new T.ConeGeometry(1,1,7),new T.MeshStandardMaterial({roughness:1}),foliage.length)
  foliage.forEach((matrix,i)=>{forest.setMatrixAt(i,matrix);forest.setColorAt(i,forestColors[i])});forest.name='mountainside-forest';forest.receiveShadow=true;forest.computeBoundingSphere();group.add(forest)
  const stems=new T.InstancedMesh(new T.CylinderGeometry(.6,.8,1,5),new T.MeshStandardMaterial({color:'#493e39',roughness:1}),trunks.length)
  trunks.forEach((matrix,i)=>stems.setMatrixAt(i,matrix));stems.computeBoundingSphere();group.add(stems)

  const rocks=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({roughness:1}),170)
  for(let i=0;i<170;i++){
    const z=-45+blossomRandom(i+312)*110,x=streamX(z)+(i%2?1:-1)*(2.2+blossomRandom(i+311)*1.5),size=.2+blossomRandom(i+841)*.65
    dummy.position.set(x,groundHeight(x,z)+size*.22,z);dummy.scale.set(size,size*.6,size*.8);dummy.rotation.set(i*.1,i,0);dummy.updateMatrix()
    rocks.setMatrixAt(i,dummy.matrix);rocks.setColorAt(i,new T.Color(i%3?'#8e9189':'#757e7d'))
  }
  rocks.name='stream-bank-stones';rocks.receiveShadow=true;rocks.computeBoundingSphere();group.add(rocks)
  return group
}
