import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as T from 'three'
import { times, type TimeOfDay } from './data'
import { blossomRandom } from './model'

const vertex=`varying vec2 vUv; varying vec3 vDirection;
void main(){vUv=uv;vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
const disc=`varying vec2 vUv;uniform vec3 tint;uniform float opacity;uniform float moon;
void main(){
  vec2 p=vUv*2.-1.;float r=length(p);if(r>1.)discard;
  float light=1.;
  if(moon>.5){
    vec3 normal=vec3(p,sqrt(max(0.,1.-r*r)));
    light=.22+.78*max(0.,dot(normal,normalize(vec3(-.45,.3,.85))));
    for(int i=0;i<15;i++){
      float n=float(i);vec2 center=vec2(sin(n*17.13),cos(n*9.71))*.71;
      float radius=.045+.09*fract(sin(n*37.7+4.)*43758.5);
      float d=length(p-center)/radius;
      light-=.16*(1.-smoothstep(.35,1.,d));
      light+=.065*exp(-pow((d-1.)*7.,2.))*(p.y>center.y?1.:-1.);
    }
    light*=.95+.05*sin(p.x*88.)*sin(p.y*69.);
  }
  gl_FragColor=vec4(tint*light,opacity*(1.-smoothstep(.97,1.,r)));
}`
const halo=`varying vec2 vUv;uniform vec3 tint;uniform float opacity;
void main(){float r=length(vUv*2.-1.);float glow=exp(-r*r*8.)*(1.-smoothstep(.6,1.,r));gl_FragColor=vec4(tint,glow*opacity);}`
const sky=`varying vec3 vDirection;uniform vec3 horizon;uniform vec3 zenith;uniform vec3 direction;uniform vec3 warmth;uniform float glow;
void main(){vec3 ray=normalize(vDirection);float altitude=smoothstep(-.08,.65,ray.y);
vec3 color=mix(horizon,zenith,altitude);color+=warmth*pow(max(0.,dot(ray,direction)),32.)*glow;
gl_FragColor=vec4(color,1.);}`
const starVertex=`attribute float size;attribute float phase;attribute vec3 starColor;
varying vec3 vColor;varying float vTwinkle;uniform float uTime;uniform float uTwinkle;
void main(){vColor=starColor;vTwinkle=.78+.22*sin(uTime*1.35+phase)*uTwinkle;
gl_PointSize=size;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
const starFragment=`varying vec3 vColor;varying float vTwinkle;uniform float uOpacity;
void main(){vec2 p=gl_PointCoord*2.-1.;float r=length(p);if(r>1.)discard;
float a=pow(1.-smoothstep(.15,1.,r),.7);gl_FragColor=vec4(vColor,a*uOpacity*vTwinkle);}`
function Orb({time,moon}:{time:TimeOfDay;moon:boolean}) {
  const group=useRef<T.Group>(null)
  const bodyMaterial=useRef<T.ShaderMaterial>(null),haloMaterial=useRef<T.ShaderMaterial>(null)
  const uniforms=useMemo(()=>({tint:{value:new T.Color(moon?'#dbe7ff':'#ffdab0').multiplyScalar(moon?1.3:3)},opacity:{value:0},moon:{value:moon?1:0}}),[moon])
  const glow=useMemo(()=>({tint:{value:new T.Color(moon?'#bdceff':'#ffbc73')},opacity:{value:0}}),[moon])
  const position=useMemo(()=>new T.Vector3(...times[moon?'night':time==='dusk'?'dusk':'dawn'].position),[time,moon])
  useFrame(({camera},dt)=>{
    if(!bodyMaterial.current||!haloMaterial.current)return
    const uniforms=bodyMaterial.current.uniforms,glow=haloMaterial.current.uniforms
    const visible=moon?time==='night':time!=='night'
    uniforms.opacity.value=T.MathUtils.damp(uniforms.opacity.value,visible?1:0,3,dt)
    glow.opacity.value=uniforms.opacity.value*(moon?.16:.32)
    if(group.current){group.current.position.lerp(position,1-Math.exp(-dt*2));group.current.quaternion.copy(camera.quaternion);group.current.visible=uniforms.opacity.value>.001}
  })
  return <group ref={group} name={moon?'valley-moon':'valley-sun'} position={position}>
    <mesh><planeGeometry args={[moon?22:34,moon?22:34]}/><shaderMaterial ref={haloMaterial} vertexShader={vertex} fragmentShader={halo} uniforms={glow} transparent depthWrite={false} blending={T.AdditiveBlending}/></mesh>
    <mesh><planeGeometry args={[moon?8:9,moon?8:9]}/><shaderMaterial ref={bodyMaterial} vertexShader={vertex} fragmentShader={disc} uniforms={uniforms} transparent depthWrite={false}/></mesh>
  </group>
}

function StarField({time,reduced}:{time:TimeOfDay;reduced:boolean}) {
  const geometry=useMemo(()=>{
    const count=4200,positions=new Float32Array(count*3),sizes=new Float32Array(count),phases=new Float32Array(count),colors=new Float32Array(count*3)
    const color=new T.Color()
    for(let i=0;i<count;i++){
      const y=.004+Math.pow(blossomRandom(i+31),3)*.72,angle=blossomRandom(i+32)*Math.PI*2,radius=Math.sqrt(1-y*y)*270
      positions[i*3]=Math.cos(angle)*radius;positions[i*3+1]=y*270;positions[i*3+2]=Math.sin(angle)*radius
      sizes[i]=2.6+Math.pow(blossomRandom(i+33),2)*5.4
      phases[i]=blossomRandom(i+34)*Math.PI*2
      color.set(blossomRandom(i+35)>.82?'#ffe9cf':'#dfe8ff').multiplyScalar(1.3+blossomRandom(i+36)*1.5)
      colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b
    }
    const geometry=new T.BufferGeometry()
    geometry.setAttribute('position',new T.BufferAttribute(positions,3))
    geometry.setAttribute('size',new T.BufferAttribute(sizes,1))
    geometry.setAttribute('phase',new T.BufferAttribute(phases,1))
    geometry.setAttribute('starColor',new T.BufferAttribute(colors,3))
    return geometry
  },[])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  const uniforms=useMemo(()=>({uOpacity:{value:0},uTime:{value:0},uTwinkle:{value:reduced?0:1}}),[reduced])
  useFrame((_,dt)=>{
    uniforms.uOpacity.value=T.MathUtils.damp(uniforms.uOpacity.value,time==='night'?1:time==='dusk'?.12:0,1.6,dt)
    uniforms.uTime.value+=dt
  })
  return <points geometry={geometry} renderOrder={-5} name="valley-stars" frustumCulled={false}>
    <shaderMaterial vertexShader={starVertex} fragmentShader={starFragment} uniforms={uniforms} transparent depthWrite={false} blending={T.AdditiveBlending}/>
  </points>
}

export default function Celestial({time,reduced}:{time:TimeOfDay;reduced:boolean}) {
  const skyGroup=useRef<T.Group>(null)
  const skyMaterial=useRef<T.ShaderMaterial>(null)
  const uniforms=useMemo(()=>({horizon:{value:new T.Color(times[time].background)},zenith:{value:new T.Color('#617f9e')},direction:{value:new T.Vector3(...times[time].position).normalize()},warmth:{value:new T.Color('#ffcfa8')},glow:{value:.25}}),[])
  const colors=useMemo(()=>({horizon:new T.Color(times[time].background),zenith:new T.Color(time==='night'?'#070d22':time==='dusk'?'#584567':'#617f9e'),direction:new T.Vector3(...times[time].position).normalize()}),[time])
  useFrame(({camera},dt)=>{
    if(!skyMaterial.current)return
    const uniforms=skyMaterial.current.uniforms
    skyGroup.current?.position.copy(camera.position)
    const t=1-Math.exp(-dt*2)
    uniforms.horizon.value.lerp(colors.horizon,t);uniforms.zenith.value.lerp(colors.zenith,t);uniforms.direction.value.lerp(colors.direction,t)
    uniforms.glow.value=T.MathUtils.damp(uniforms.glow.value,time==='night'?0:time==='dusk'?.45:.25,2,dt)
  })
  return <>
    <group ref={skyGroup}>
      <mesh renderOrder={-10} name="valley-sky"><sphereGeometry args={[300,32,16]}/><shaderMaterial ref={skyMaterial} vertexShader={vertex} fragmentShader={sky} uniforms={uniforms} side={T.BackSide} depthWrite={false}/></mesh>
      <StarField time={time} reduced={reduced}/>
    </group>
    <Orb time={time} moon={false}/><Orb time={time} moon/>
  </>
}
