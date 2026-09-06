import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { blossomRandom } from './model'

type TreePosition = { x:number; y:number; z:number; scale:number; seed:number }

// Small, separate five-lobed flowers keep the distant grove airy without canopy solids.
function groveFlower() {
  const positions:number[]=[]
  for(let i=0;i<10;i++){
    const a=i*Math.PI/5,b=(i+1)*Math.PI/5,r=i%2?.48:1,s=i%2?1:.48
    positions.push(0,0,.08,Math.cos(a)*r,Math.sin(a)*r,0,Math.cos(b)*s,Math.sin(b)*s,0)
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals()
  return geometry
}

function groveTree(seed:number,detail:number) {
  const branches:T.BufferGeometry[]=[],flowers:T.BufferGeometry[]=[],floret=groveFlower(),dummy=new T.Object3D()
  const rnd=(n:number)=>blossomRandom(seed+n),colors=['#ffe9ee','#f1bbcf','#fff2ed','#e7a7c1']
  function branch(points:T.Vector3[],radius:number,tip:number,segments=4) {
    const curve=new T.CatmullRomCurve3(points),geometry=new T.TubeGeometry(curve,segments,1,5,false),vertices=geometry.getAttribute('position')
    for(let i=0;i<=segments;i++){
      const t=i/segments,center=curve.getPointAt(t),width=T.MathUtils.lerp(radius,tip,t)
      for(let j=0;j<=5;j++){
        const k=i*6+j,p=new T.Vector3().fromBufferAttribute(vertices,k).sub(center).multiplyScalar(width).add(center)
        vertices.setXYZ(k,p.x,p.y,p.z)
      }
    }
    geometry.computeVertexNormals();branches.push(geometry);return curve
  }
  const trunk=branch([new T.Vector3(0,-.12,0),new T.Vector3(-.1,.65,.04),new T.Vector3(.12,1.3,-.05),new T.Vector3(.2,1.85,.08)],.12,.045,6)
  for(let i=0;i<5;i++){
    const angle=i*2.399+rnd(i)*.3,reach=1.2+rnd(i+10)*.5,start=trunk.getPoint(.43+i*.12)
    const end=start.clone().add(new T.Vector3(Math.cos(angle)*reach,.65+rnd(i+20)*.6,Math.sin(angle)*reach))
    const limb=branch([start,start.clone().lerp(end,.45).add(new T.Vector3(0,-.14,0)),end],.055,.016)
    for(let j=0;j<(detail===0?2:3);j++){
      const n=i*300+j*80,at=limb.getPoint(.4+j*.23),a=angle+(j%2?1:-1)*.85
      const tip=at.clone().add(new T.Vector3(Math.cos(a)*.8,.3+rnd(n+40)*.3,Math.sin(a)*.8))
      const secondary=branch([at,at.clone().lerp(tip,.5),tip],.018,.006,3)
      for(let k=0;k<(detail===2?3:2);k++){
        const m=n+k*20,p=secondary.getPoint(.32+k*.3),direction=a+(k%2?1:-1)*.7
        const twigEnd=p.clone().add(new T.Vector3(Math.cos(direction)*.65,k===2?-.12:.24,Math.sin(direction)*.65))
        const twig=branch([p,p.clone().lerp(twigEnd,.5).add(new T.Vector3(0,.09,0)),twigEnd],.007,.002,2)
        for(let b=0;b<(detail===0?3:4);b++)for(let f=0;f<2;f++){
          const key=m+b*4+f,center=twig.getPoint(.18+b*(detail===0?.36:.26))
          dummy.position.copy(center).add(new T.Vector3((rnd(key+51)-.5)*.16,(rnd(key+61)-.5)*.18,(rnd(key+71)-.5)*.16))
          dummy.rotation.set(rnd(key+81)*Math.PI,rnd(key+91)*Math.PI,rnd(key+101)*Math.PI)
          dummy.scale.setScalar(.075+rnd(key+111)*.06+(detail===0?.025:0));dummy.updateMatrix()
          const flower=floret.clone().applyMatrix4(dummy.matrix),color=new T.Color(colors[Math.floor(rnd(key+121)*colors.length)]),tints=[]
          for(let v=0;v<flower.getAttribute('position').count;v++)tints.push(color.r,color.g,color.b)
          flower.setAttribute('color',new T.Float32BufferAttribute(tints,3));flowers.push(flower)
        }
      }
    }
  }
  const bark=mergeGeometries(branches)!,blossoms=mergeGeometries(flowers)!
  floret.dispose();branches.forEach(g=>g.dispose());flowers.forEach(g=>g.dispose())
  return {bark,blossoms}
}

export function buildCherryGrove(trees:TreePosition[]) {
  const group=new T.Group();group.name='valley-cherry-grove'
  const barkMaterial=new T.MeshStandardMaterial({color:'#503c44',roughness:1})
  const flowerMaterial=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.95})
  const dummy=new T.Object3D()
  // Reuse three branch-and-flower models; finer detail belongs nearest the courtyard.
  for(let detail=0;detail<3;detail++){
    const positions=trees.filter(t=>{const r=Math.hypot(t.x,t.z);return detail===(r<40?2:r<68?1:0)})
    const model=groveTree(1200+detail*137,detail)
    const bark=new T.InstancedMesh(model.bark,barkMaterial,positions.length),flowers=new T.InstancedMesh(model.blossoms,flowerMaterial,positions.length)
    positions.forEach((tree,i)=>{
      dummy.position.set(tree.x,tree.y,tree.z);dummy.rotation.set(0,blossomRandom(tree.seed)*Math.PI*2,0)
      dummy.scale.set(tree.scale,tree.scale*(.9+blossomRandom(tree.seed+2)*.2),tree.scale);dummy.updateMatrix()
      bark.setMatrixAt(i,dummy.matrix);flowers.setMatrixAt(i,dummy.matrix)
      flowers.setColorAt(i,new T.Color(['#ffffff','#ffe1ec','#f6d6e4'][tree.seed%3]))
    })
    bark.name=`grove-branches-${detail}`;flowers.name=`grove-blossoms-${detail}`
    for(const mesh of [bark,flowers]){mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh)}
  }
  return group
}
