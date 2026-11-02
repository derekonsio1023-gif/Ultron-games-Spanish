import{C as e,S as t,_ as n,c as r,d as i,f as a,l as o,u as s,v as c,w as l,y as u}from"./texture-DGW1s1ZG.js";import{At as d,Ct as f,Dt as p,Et as m,Ft as h,It as g,J as _,Ot as v,St as y,bt as b,in as x,jt as S,kt as C,vt as w,wt as T,yt as E}from"./index-Ps5vu5xC.js";import{n as D,o as O,s as k,t as A}from"./meadowGroundingShadowMaterial-CbgK0a9-.js";function j(e){let t=(t,n=1)=>{let r=k(e,{name:t});return r.emissiveVertexColor=!0,r.emissiveIntensity=n,r.update(),r};return{shell:t(`Unlit Bomb • Painted Charcoal Iron`,4),collar:t(`Unlit Bomb • Worn Iron Collar`),rope:t(`Unlit Bomb • Twisted Flax Fibers`),spark:d(S(`Bomb golden fuse spark`,[1,.92,.37],[1,.22,.015],[1,.63,.055],[1,.39,.025]),{opacity:.9}),core:d(S(`Bomb spark cream core`,[1,1,.85],[1,.76,.2],[1,.98,.64],[1,.9,.39]))}}function M(e){let t=k(e,{name:`Unlit Tools • Oak, Steel, Enamel & Leather`});return t.emissiveVertexColor=!0,t.update(),t}function N(e){let t=k(e,{name:`Unlit Backpack • Canvas & Leather`});return t.emissiveVertexColor=!0,t.update(),t}function P(e){let t=t=>{let n=k(e,{name:t});return n.emissiveVertexColor=!0,n.update(),n};return{body:t(`Unlit Vacuum • Painted Red Enamel`),trim:t(`Unlit Vacuum • Painted Cream Enamel`),rubber:t(`Unlit Vacuum • Soft Charcoal Rubber`)}}var F=`
attribute vec3 vertex_position;
attribute vec3 vertex_normal;
attribute vec2 vertex_texCoord0;
attribute vec2 vertex_texCoord1;
attribute vec3 vertex_texCoord2;
attribute vec4 vertex_color;
#ifdef INSTANCING
attribute vec4 instance_cartCenter;
attribute vec4 instance_cartRotation;
attribute vec4 instance_cartSize;
attribute vec4 instance_cartVariation;
attribute vec4 instance_cartSurface;
vec3 rotateStraw(vec3 value) {
    vec4 q = instance_cartRotation;
    return value + 2.0 * cross(q.xyz, cross(q.xyz, value) + q.w * value);
}
#endif
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform vec4 uCartMotion;
uniform vec4 uCartImpact;
uniform vec3 uSunDirection;
varying vec2 vUv;
varying vec2 vFaceUv;
varying vec4 vVariation;
varying vec2 vLight;
varying float vBirth;

void main(void) {
    vBirth = vertex_texCoord1.x;
    vec3 position = vertex_position;
    vec3 localNormal = vertex_normal;
    vec3 localSurface = vertex_texCoord2;
    vec4 variation = vertex_color;
    float strawLength = vertex_texCoord1.y;
#ifdef INSTANCING
    vBirth = instance_cartCenter.w;
    position = rotateStraw(vertex_position * instance_cartSize.xyz) + instance_cartCenter.xyz;
    localNormal = rotateStraw(vertex_normal);
    localSurface = instance_cartSurface.xyz;
    variation = vec4(instance_cartVariation.xyz, instance_cartSize.w);
    strawLength = instance_cartSize.z;
#endif
    float span = max(0.0001, uCartMotion.y - uCartMotion.x);
    float fraction = clamp((vBirth - uCartMotion.x) / span, 0.0, 1.0);
    float bornAt = uCartMotion.w * (1.0 - sqrt(1.0 - fraction));
    float age = uCartMotion.z - bornAt;
    if (vBirth > uCartMotion.x && vBirth <= uCartMotion.y) {
        float settling = pow(1.0 - clamp(age / 0.28, 0.0, 1.0), 2.0);
        position.y += settling * (position.y < 0.75 ? 0.035 : 0.075);
        position.xz += vec2(sin(vBirth * 4.7), cos(vBirth * 3.1)) * settling * 0.014;
    }
    float distanceToImpact = length(position.xz - uCartImpact.xz);
    float wave = clamp((uCartMotion.z - distanceToImpact * 0.07) / 0.42, 0.0, 1.0);
    float nearby = max(0.0, 1.0 - distanceToImpact / 0.65)
        * max(0.0, 1.0 - abs(position.y - uCartImpact.y) / 0.32);
    if (vBirth <= uCartMotion.x) position.y -= sin(wave * 3.14159) * nearby * uCartImpact.w * 0.014;
    vec3 normal = normalize(mat3(matrix_model) * localNormal);
    vec3 surfaceNormal = normalize(mat3(matrix_model) * localSurface);
    float wrapped = dot(normal, uSunDirection) * 0.5 + 0.5;
    vLight = vec2(wrapped * wrapped, mix(0.72, 1.0, max(0.0, dot(surfaceNormal, uSunDirection))));
    vVariation = variation;
    vFaceUv = vertex_texCoord0;
    vUv = vertex_texCoord0 * vec2(0.18, strawLength * ${E.textureDensity.toFixed(2)})
        + fract(variation.gb * vec2(37.719, 91.533));
    gl_Position = matrix_viewProjection * matrix_model * vec4(position, 1.0);
}
`,I=`
#include "gammaPS"
uniform sampler2D uHayTexture;
uniform float uCartProgress;
uniform vec3 uShadowTint;
uniform vec3 uSunTint;
varying vec2 vUv;
varying vec2 vFaceUv;
varying vec4 vVariation;
varying vec2 vLight;
varying float vBirth;
${f}
void main(void) {
    // Entire stems appear together. There is no alpha fade or screen-door mask.
    if (vBirth > uCartProgress) discard;
    vec3 hsv = rgbToHsv(texture2D(uHayTexture, vUv).rgb);
    hsv.x = fract(hsv.x + vVariation.x);
    hsv.y = clamp(hsv.y * vVariation.y, 0.0, 1.0);
    hsv.z = clamp(mix(${E.textureValueCenter}, hsv.z, ${E.textureContrast}) * vVariation.z, 0.0, 1.0);
    float edge = 1.0 - smoothstep(0.015, ${E.edgeWidth}, min(vFaceUv.x, 1.0 - vFaceUv.x));
    vec3 surface = gammaCorrectInput(hsvToRgb(hsv)) * (1.0 - edge * ${E.edgeDarkening});
    vec3 light = mix(uShadowTint, uSunTint, vLight.x)
        * (${E.ambientStrength} + ${E.sunStrength} * vLight.x) * vLight.y;
    gl_FragColor = vec4(gammaCorrectOutput(clamp(surface * light * vVariation.a, 0.0, 1.0)), 1.0);
}
`;function L(d){let f=new x({uniqueName:`OpaqueCollectedHay`,vertexGLSL:F,fragmentGLSL:I,attributes:{vertex_position:u,vertex_normal:c,vertex_texCoord0:t,vertex_texCoord1:e,vertex_texCoord2:l,vertex_color:n,instance_cartCenter:r,instance_cartRotation:o,instance_cartSize:s,instance_cartVariation:i,instance_cartSurface:a}});f.name=`Unlit Hay Cart • Opaque Collected Straw`,f.setParameter(`uHayTexture`,d),f.setParameter(`uCartProgress`,100),f.setParameter(`uCartMotion`,[-1,-1,999,1]),f.setParameter(`uCartImpact`,[0,0,0,0]),f.setParameter(`uShadowTint`,[...E.shadowTint]),f.setParameter(`uSunTint`,[...E.sunTint]);let p=Math.hypot(...E.sunDirection);return f.setParameter(`uSunDirection`,E.sunDirection.map(e=>e/p)),f.update(),f}function R(e){return{paint:z(e.cartPaint,`Unlit Hay Cart • Barn Red Painted Wood`),wood:z(e.cartWood,`Unlit Hay Cart • Honey Timber`),straw:L(e.hay[0]),sign:k(e.cartSign,{name:`Unlit Hay Cart • Sell Hay Sign`}),iron:z(e.shedMetal,`Unlit Hay Cart • Charcoal Iron`,[.28,.29,.3]),cream:z(e.shedIvory,`Unlit Hay Cart • Warm Ivory Enamel`,[1,.97,.9])}}function z(e,t,n=[1,1,1]){let r=k(e,{name:t,tint:n});return r.emissiveVertexColor=!0,r.update(),r}function B(e){return{backwall:V(e.shedIvory,`Unlit Shed • Oatmeal Painted Interior`,[.91,.89,.84]),wood:V(e.shedTimber,`Unlit Shed • Quiet Honey Wood`,[1.1,1.025,.91],90),trim:V(e.shedIvory,`Unlit Shed • Buttery Ivory Frame`),boards:V(e.shedPaint,`Unlit Shed • Warm Barn Red`,[1.38,1.3,1.23]),roof:V(e.shedMetal,`Unlit Shed • Soft Silver Zinc`),endgrain:V(e.shedEndgrain,`Unlit Shed • Sawn Honey Wood`,[1.12,1.13,1.08]),emblem:V(e.shedIvory,`Unlit Shed • Ivory Painted Emblem`),hardware:V(e.shedMetal,`Unlit Shed • Warm Charcoal Metal`,[.46,.47,.49])}}function V(e,t,n=[1,1,1],r=0){let i=k(e,{name:t,tint:n});return i.emissiveVertexColor=!0,i.emissiveMapRotation=r,i.update(),i}function H(e,t,n,r,i){let a=m(e,t),{createGradient:o,createSurfaceMaterial:s}=a,c=i??w(e,t,n,r),l=A([.3,.235,.105],.3),u=y(r,`grass`),d=y(r,`mown`);a.own(u),a.own(d);let f={...c,tool:M(r.toolAtlas),backpack:N(r.backpackAtlas),vacuum:P(r.vacuumAtlas),bomb:j(r.bombAtlas),stumpEndgrain:O(r.stumpEndgrain),diamondWell:D(r.diamondWellAtlas),hayCart:R(r),workshop:B(r),accent:o(T.accent),basketWood:o(T.basketWood),dockWood:s(T.dockWood,r.wood,p.dockWood),dockWoodAlternate:s(T.dockWoodAlternate,r.wood,p.dockWoodAlternate),groundSurface:s(T.ground,r.grass,p.islandGround,{colorZones:_,side:{averageColor:C.dirt,colorScale:1.3,texture:r.dirt}}),hayLight:o(T.hayLight),movingSupport:o(T.movingSupport),meadowDistantSurface:c.groundTerrainSurface,meadowGrassSurface:u,meadowGrass:o(T.meadowGrass),meadowDirtPatchSurface:s(v,r.dirt,p.yardDirtOverlay,{vertexColorBlend:[.34,.18,.045]}),meadowGrassRoadSurface:d,meadowGroundingShadow:l,obstacle:o(T.obstacle),outerFoliage:s(T.outerFoliage,r.treeFoliage,p.outerFoliage,{vertexColorBlend:[.055,.1,.035]}),treeBark:s(T.treeBark,r.treeBark,p.treeBark),treeDistantBark:s(T.treeDistantBark,r.treeBark,p.distantTreeBark),treeDistantFoliage:s(T.treeDistantFoliage,r.treeFoliage,p.distantTreeFoliage),treeFoliage:s(T.treeFoliage,r.treeFoliage,p.treeFoliage)},x=h(f),S=r.onTextureReplaced((e,t)=>{for(let n of x)g(n,e,t)});for(let e of[f.groundSurface,f.meadowGrassSurface,f.meadowGrass,f.meadowGrassRoadSurface,f.meadowDirtPatchSurface])b(e);return[f.tool,f.backpack,...Object.values(f.vacuum),...Object.values(f.bomb),f.stumpEndgrain,f.diamondWell,...Object.values(f.hayCart),...Object.values(f.workshop),f.meadowGroundingShadow].forEach(a.own),{...f,destroy:()=>{S(),a.destroy(),i||c.destroy()}}}export{H as createGameMaterials};