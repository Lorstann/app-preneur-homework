"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    camera.position.z = 8;

    // Soft particle field: calmer and more elegant than a single spinning mesh.
    const particleCount = 1400;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const colorA = new THREE.Color("#60a5fa");
    const colorB = new THREE.Color("#22d3ee");
    const colorC = new THREE.Color("#a78bfa");

    for (let i = 0; i < particleCount; i += 1) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 22;
      positions[i3 + 1] = (Math.random() - 0.5) * 14;
      positions[i3 + 2] = (Math.random() - 0.5) * 16;

      const mixed = colorA.clone().lerp(colorB, Math.random()).lerp(colorC, Math.random() * 0.35);
      colors[i3] = mixed.r;
      colors[i3 + 1] = mixed.g;
      colors[i3 + 2] = mixed.b;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const glowGeometry = new THREE.IcosahedronGeometry(2.3, 2);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: "#93c5fd",
      transparent: true,
      opacity: 0.09,
      wireframe: true,
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glowMesh);

    const ambient = new THREE.AmbientLight("#dbeafe", 0.7);
    scene.add(ambient);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    let animationId = 0;
    let t = 0;
    const animate = () => {
      t += 0.004;
      particles.rotation.y += 0.0008;
      particles.rotation.x = Math.sin(t * 0.7) * 0.05;
      glowMesh.rotation.x += 0.0012;
      glowMesh.rotation.y -= 0.0017;

      // Gentle vertical wave for alive background feeling.
      const posAttr = particleGeometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i += 1) {
        const i3 = i * 3;
        const x = positions[i3];
        posAttr.array[i3 + 1] = positions[i3 + 1] + Math.sin(t * 2 + x * 0.35) * 0.015;
      }
      posAttr.needsUpdate = true;

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
      particleGeometry.dispose();
      particleMaterial.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className="three-bg" ref={mountRef} />;
}
