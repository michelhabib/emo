const canvas = document.getElementById('renderCanvas');

        const engine = new BABYLON.Engine(canvas);

        const createLights = function (scene) {
            // Create a default light
            // dLight = scene.createDefaultLight(true);
            // dLight.intensity = 0.5; 
            // const light = new BABYLON.PointLight("plight", new BABYLON.Vector3(0, 5,3), scene);
            const light = new BABYLON.HemisphericLight("HemiLight", new BABYLON.Vector3(0, 5, 0), scene);
            light.diffuse = new BABYLON.Color3(1, 1, 1);
            light.specular = new BABYLON.Color3(0, 0, 0.3);
            light.intensity = 5; // Adjust intensity as needed           
        }

        const createCamera = function (scene) {
            const cameraTarget = new BABYLON.Vector3(0, 3, 0);
            const camera = new BABYLON.ArcRotateCamera("faceCam", Math.PI / 4, Math.PI / 4, 10, cameraTarget, scene);
            camera.setPosition(new BABYLON.Vector3(0, 6, 8)); // Set initial position
            camera.ellipsoid = new BABYLON.Vector3(3, 6, 3);
            camera.minZ = 0; // Set near plane to avoid clipping
            camera.checkCollisions = true;
            camera.wheelDeltaPercentage = 0.01; // Adjust zoom sensitivity
            camera.lowerRadiusLimit = 1;  // adjust so you can’t “enter” the mesh
            camera.attachControl(canvas, true);
        }

        const loadCharacterDebug = function (scene) {
            BABYLON.SceneLoader.ImportMeshAsync("", "", "src/gltf/jammo_v1.3.gltf", scene)
            .then(({ meshes, skeletons, animationGroups }) => {
                const skel   = skeletons[0];
                const eyeL   = skel.bones.find(b => /EyeLeft/i.test(b.name));
                const eyeR   = skel.bones.find(b => /EyeRight/i.test(b.name));
                const nodeL = eyeL.getTransformNode();
                const nodeR = eyeR.getTransformNode();

                // Store initial positions and scales
                const initialPosL = nodeL.position.clone();
                const initialPosR = nodeR.position.clone();
                const initialScaleL = nodeL.scaling.clone();
                const initialScaleR = nodeR.scaling.clone();

                // Eye tracking state
                const eyeTracking = {
                    currentX: 0,
                    currentY: 0,
                    targetX: 0,
                    targetY: 0,
                    lastMouseMoveTime: 0,
                    mouseInCanvas: false,
                    delayBeforeResponse: 100,
                    followSpeed: 0.1,
                    eyeRange: 0.3
                };

                // Blinking state
                const blinkState = {
                    settings: {
                        closePercentage: 0.8,
                        timeBetweenBlinks: 4000,
                        randomization: 0.3
                    },
                    nextBlinkTime: performance.now() + 2000,
                    isBlinking: false,
                    blinkStartTime: 0,
                    blinkDuration: 150,
                    currentScaleY: 1
                };

                // Mouse event handlers
                canvas.addEventListener('mouseenter', () => {
                    eyeTracking.mouseInCanvas = true;
                });
                
                canvas.addEventListener('mouseleave', () => {
                    eyeTracking.mouseInCanvas = false;
                    eyeTracking.targetX = 0;
                    eyeTracking.targetY = 0;
                });

                canvas.addEventListener('mousemove', () => {
                    eyeTracking.lastMouseMoveTime = performance.now();
                });

                // Kill existing animations
                scene.stopAnimation(nodeL);
                scene.stopAnimation(nodeR);

                // Eye tracking function
                function updateEyeTracking() {
                    const currentTime = performance.now();
                    const timeSinceMouseMove = currentTime - eyeTracking.lastMouseMoveTime;
                    
                    if (eyeTracking.mouseInCanvas && timeSinceMouseMove > eyeTracking.delayBeforeResponse) {
                        const rect = canvas.getBoundingClientRect();
                        const mouseX = (scene.pointerX - rect.width / 2) / (rect.width / 2);
                        const mouseY = -(scene.pointerY - rect.height / 2) / (rect.height / 2);
                        
                        eyeTracking.targetX = mouseX * eyeTracking.eyeRange;
                        eyeTracking.targetY = mouseY * eyeTracking.eyeRange;
                    }
                    
                    // Smooth interpolation
                    eyeTracking.currentX += (eyeTracking.targetX - eyeTracking.currentX) * eyeTracking.followSpeed;
                    eyeTracking.currentY += (eyeTracking.targetY - eyeTracking.currentY) * eyeTracking.followSpeed;
                }

                // Blinking function
                function updateBlinking() {
                    const currentTime = performance.now();
                    
                    // Check if it's time to blink
                    if (!blinkState.isBlinking && currentTime >= blinkState.nextBlinkTime) {
                        blinkState.isBlinking = true;
                        blinkState.blinkStartTime = currentTime;
                        
                        // Calculate next blink time with randomization
                        const randomRange = blinkState.settings.timeBetweenBlinks * blinkState.settings.randomization;
                        const randomOffset = (Math.random() - 0.5) * randomRange;
                        blinkState.nextBlinkTime = currentTime + blinkState.settings.timeBetweenBlinks + randomOffset;
                    }
                    
                    // Handle blink animation
                    if (blinkState.isBlinking) {
                        const blinkProgress = (currentTime - blinkState.blinkStartTime) / blinkState.blinkDuration;
                        
                        if (blinkProgress >= 1) {
                            blinkState.isBlinking = false;
                            blinkState.currentScaleY = 1;
                        } else {
                            const blinkCurve = Math.sin(blinkProgress * Math.PI);
                            blinkState.currentScaleY = 1 - (blinkCurve * blinkState.settings.closePercentage);
                        }
                    }
                }

                // Apply eye transformations
                function applyEyeTransformations() {
                    // Apply position
                    nodeL.position.x = initialPosL.x + eyeTracking.currentX;
                    nodeL.position.y = initialPosL.y + eyeTracking.currentY;
                    nodeR.position.x = initialPosR.x + eyeTracking.currentX;
                    nodeR.position.y = initialPosR.y + eyeTracking.currentY;
                    
                    // Apply blinking scale
                    nodeL.scaling.z = initialScaleL.y * blinkState.currentScaleY;
                    nodeR.scaling.z = initialScaleR.y * blinkState.currentScaleY;
                    
                    nodeL.markAsDirty();
                    nodeR.markAsDirty();
                }

                // Separate render observers
                scene.onAfterRenderObservable.add(() => {
                    updateEyeTracking();
                    applyEyeTransformations();
                });

                scene.onAfterRenderObservable.add(() => {
                    updateBlinking();
                });
            });
        }

        const createScene = function () {
            const scene = new BABYLON.Scene(engine);
            scene.collisionEnabled = true;            
            createLights(scene);
            createCamera(scene);
            loadCharacterDebug(scene);
            scene.debugLayer.show({
                embedMode:true
            });

            // In your script.js file, you can now use:
            const debugHelpers = createDebugHelpers(scene);
                        
            return scene;
        }

        const scene = createScene();

        engine.runRenderLoop(function () {
            scene.render();
        });

        window.addEventListener('resize', function () {
            engine.resize();
        });