# Room fidelity runtime

The November 13 approved v6 Blender asset is integrated into the existing vanilla
WebGL2 homepage renderer. The private Three.js study supplied the material and
baked-light reference; its reduced interface is not the public homepage runtime.
Navigation, toy hopping, cats, object stories, photo activities, the standing desk,
monitor, music, lights and voice controls retain their existing owners.

`room/room-config.js` selects the versioned room GLB and lighting manifest.
The room contains 1,171,155 triangles. Four RGBM WebP atlases provide diffuse light
through UV1; replacement shoe and cloth geometry carries linear FLOAT3
`_R5_IRRADIANCE`. Neither representation contains the surface albedo: PBR color,
roughness and normal detail remain separate. RGBM image decoding must use
`premultiplyAlpha: 'none'` and no color conversion because alpha stores magnitude.
AgX tone mapping is adapted from Three.js under the included MIT license.

Diffuse illumination is baked, so it stays available while moving without sample
accumulation. The existing light controls scale and tint that bake; they do not
rebake global illumination. Specular response, mirror captures, cat contact and
monitor content remain live. The moving desk carries its baked diffuse light with
its surfaces. Desktop targets 60 Hz and compact/touch viewports target 30 Hz; the
browser and hardware still determine actual performance. Local Chrome testing
was display-limited near 30 Hz and is not physical-phone evidence.

The entrance leaf uses an oriented player collider and a conservative cat AABB.
The cat bed support grid is sampled from the final bedding geometry. The original
70-inch desk, queen mattress and bathroom route remain scale/layout anchors.

The curated GLB and four atlases total about 83 MB before transport compression.
The new share film is a captured 24-second moving walkthrough. Original photos,
editable Blender source, intermediate exports and private comparison pages stay
outside the deployment. Material extras retain only the baked-light group or
vertex-light flag; authoring metadata is stripped from the public GLB.

Verify with `node --test tools/*.test.cjs`, `tools/check-site.sh`, and a local
header-replaying browser preview. Before release, inspect actual WebGL rendering,
movement, both cats, camera modes, a story, mirror, desk, film, lighting and compact
controls. After the approved push, verify the exact Vercel commit, public assets,
rendered homepage, `/about/`, sitemap routes and photo redirects.
