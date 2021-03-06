function boxPolyVertices(positionX, positionY, extentionX, extentionY) {
	var px = positionX;
	var py = positionY;
	var ex = extentionX;
	var ey = extentionY;
	return [ {
		x : px,
		y : py
	}, {
		x : px + ex,
		y : py
	}, {
		x : px + ex,
		y : py + ey
	}, {
		x : px,
		y : py + ey
	} ];
};

var MathUtils = (function() {
	return {
		toRad : function(angle) {
			return Math.PI / 180. * angle;
		},
		toDeg : function(angle) {
			return 180. / Math.PI * angle;
		}
	};
})();

function calculateAngle(vec1,vec2){
	var v1 = new b2Vec2(vec1.x, vec1.y);
	var v2 = new b2Vec2(vec2.x, vec2.y);
	
	var dot = (vec1.x*vec2.x) + (vec1.y*vec2.y);
	var cosA = dot/(v1.Length()*v2.Length());
	return MathUtils.toDeg(Math.acos(cosA));
};

function calculateSignedAngle(vec1,vec2){
	var v1 = new b2Vec2(vec1.x, vec1.y);
	var v2 = new b2Vec2(vec2.x, vec2.y);
	
	var f = (vec1.x*vec2.y) + (vec1.y*vec2.x);
	var sinA = f/(v1.Length()*v2.Length());
	return sinA;
};

/**
 * 
 */

function DebugCanvas() {

	var canvasElm = document.getElementById("debugCanvas");
	if (!canvasElm) {
		$("#root")
				.append(
						"<canvas id='debugCanvas' width='800' height='500' style='position :absolute; top: 0 px; left: 0 px;'></canvas>");
		canvasElm = document.getElementById("debugCanvas");
	}
	this.debugDrawContext = canvasElm.getContext("2d");
	var canvasElm = document.getElementById("debugCanvas");
	this.debugDrawContext = canvasElm.getContext("2d");
	canvasElm.width = BASE_WIDTH;
	canvasElm.height = BASE_HEIGHT;

	canvasElm.style.width = BASE_WIDTH * Screen.widthRatio();
	canvasElm.style.height = BASE_HEIGHT * Screen.heightRatio();

	this.debugCanvasWidth = parseInt(canvasElm.width);
	this.debugCanvasHeight = parseInt(canvasElm.height);
	debugCanvasTop = parseInt(canvasElm.style.top);
	debugCanvasLeft = parseInt(canvasElm.style.left);
	eLog("left " + canvasElm.style.left, "top " + canvasElm.style.top);
};

var Physics = (function() {
	var world = null;
	var worldBorder = null;
	var timeout = null;
	var pause = false;
	var debugMode = true;
	var debugCanvas = null;
	var updateItems = [];
	var contactListener = null;
	var contactProcessor = null;
	// var activeContacts = new Array();

	function debugDraw() {
		if (!debugCanvas)
			return;
		debugCanvas.debugDrawContext.clearRect(0, 0,
				debugCanvas.debugCanvasWidth, debugCanvas.debugCanvasHeight);
		drawWorld(world, debugCanvas.debugDrawContext);
	}

	function debugDrawing(v) {

		if (v && !debugCanvas)
			debugCanvas = new DebugCanvas();

		if (!v && debugCanvas) {
			debugCanvas.debugDrawContext
					.clearRect(0, 0, debugCanvas.debugCanvasWidth,
							debugCanvas.debugCanvasHeight);
			debugCanvas = null;
		}

	}

	function createWorld() {
		if (world != null)
			return;
		var worldAABB = new b2AABB();
		worldAABB['minVertex']['Set'](-1000, -1000);
		worldAABB['maxVertex']['Set'](2000, 2000);
		var gravity = new b2Vec2(0, 300);
		var doSleep = true;
		world = new b2World(worldAABB, gravity, doSleep);

		contactProcessor = new ContactProcessor();
		contactListener = new ContactListener(contactProcessor);

	}

	function createWorldBorder(params) {
		assert(world);

		var SIDE = ENHANCED_BASE_MARGIN_WIDTH;
		if (!GROUND)
			var GROUND = 0;
		var ADD_HEIGHT = 1000;
		var borderWidth = 100;
		var B = borderWidth;
		var W = BASE_WIDTH;
		var H = BASE_HEIGHT;
		var WE = W + 2 * B + 2 * SIDE;
		var HE = H + 2 * B - GROUND;
		// boxPolyVertices(-B - SIDE, -B, WE, B),
		var poligons = [
				boxPolyVertices(-B - SIDE, -B - ADD_HEIGHT, B, HE + ADD_HEIGHT),
				boxPolyVertices(W + SIDE, -B - ADD_HEIGHT, B, HE + ADD_HEIGHT),
				boxPolyVertices(-B - SIDE, H - GROUND, WE, B) ];
		worldBorder = Physics.createPolyComposite(0, 0, 0, poligons);
	}

	function putToSleep() { // 2dBody function
		world['m_contactManager']['CleanContactList']();
		this['m_flags'] |= b2Body['e_sleepFlag'];
		this['m_linearVelocity']['Set'](0.0, 0.0);
		this['m_angularVelocity'] = 0.0;
		this['m_sleepTime'] = 0.0;
	}

	function setBodyPoseByShape(position, angle) {
		this['SetCenterPosition'](position, angle);
		var shapeToBody = b2Math['SubtractVV'](this['m_position'],
				this['GetShapeList']()['GetPosition']());
		this['SetCenterPosition']
				(b2Math['AddVV'](position, shapeToBody), angle);
	}
	function getShapesCount() {// 2dBody function
		var shape = this['GetShapeList']();
		var shapesCount = 0;
		for (; shape != null; ++shapesCount, shape = shape['m_next'])
			;
		return shapesCount;
	}

	function getShapeByIdx(shapeIdx) {// 2dBody function
		var shapesCount = this.getShapesCount();
		var listPosition = shapesCount - 1 - shapeIdx;
		var shape = this['GetShapeList']();
		for ( var i = 0; i < listPosition; ++i) {
			if (!shape['m_next']) {
				eLog("bad shape idx!");
				return null;
			}
			shape = shape['m_next'];
		}

		return shape;
	}

	function getLogicPose() {
		var position = undefined;
		if (this.positionInshape)
			position = this['GetShapeList']()['GetPosition']();
		else
			position = this['GetCenterPosition']();
		var x = position.x - this.offset.x;
		var y = position.y - this.offset.y;
		var angle = this['GetRotation']();
		return {
			x : x,
			y : y,
			angle : angle
		};
	}

	function setLogicPose(pose) {
		//
		var position = new b2Vec2(parseFloat(pose.x) + this.offset.x,
				parseFloat(pose.y) + this.offset.y);

		if (this.positionInshape)
			this.setPoseByShape(position, pose.angle);
		else
			this['SetCenterPosition'](position, pose.angle);
		//
	}

	function setupShapeDef(shapeDef) {
		var density = 0.01;
		shapeDef['friction'] = 0.5;
		shapeDef['restitution'] = 0.3;
		shapeDef['density'] = density;
		// shapeDef.categoryBits = 0x0001;
		// shapeDef.maskBits = 0xFFFF;
		// shapeDef.groupIndex = 0;
	}
	function setupBodyDef(bodyDef) {
		bodyDef['linearDamping'] = 0.0001;
		bodyDef['angularDamping'] = 0.001;
		// bodyDef.allowSleep = true;
		// bodyDef.isSleeping = false;
		// bodyDef.preventRotation = false;
	}
	function createBody(x, y, angle, shapeDef, shapesCount) {
		var bd = new b2BodyDef();
		setupBodyDef(bd);
		if (shapesCount != undefined) {
			for ( var i = 0; i < shapesCount; ++i)
				bd['AddShape'](shapeDef[i]);
		} else {
			bd['AddShape'](shapeDef);
		}
		bd['position']['Set'](x, y);
		bd['rotation'] = angle;
		bd['isSleeping'] = true;
		bd['allowSleep'] = true;
		var body = Physics.getWorld()['CreateBody'](bd);
		body.putToSleep = putToSleep;
		body.getShapesCount = getShapesCount;
		body.getShapeByIdx = getShapeByIdx;
		body.setPoseByShape = setBodyPoseByShape;
		body.setContactCallback = setContactCallback;
		body.getLogicPose = getLogicPose;
		body.setLogicPose = setLogicPose;
		return body;
	}

	function createPolyDef(vertices, localPosition, fixed) {
		if (typeof (fixed) == 'undefined')
			fixed = true;
		var polySd = new b2PolyDef();
		if (!fixed)
			setupShapeDef(polySd);

		if (localPosition)
			polySd['localPosition']['SetV'](localPosition);
		polySd['vertexCount'] = vertices.length;
		for ( var i = 0; i < vertices.length; i++) {
			polySd['vertices'][i]['Set'](vertices[i].x, vertices[i].y);
		}
		return polySd;
	}

	function setContactCallback(callback, shapeIdx) {
		if (shapeIdx != undefined) {
			this.getShapeByIdx(shapeIdx)['contactCallback'] = callback;
			return;
		}
		var shape = this['GetShapeList']();
		for (; shape != null; shape = shape['m_next']) {
			shape['contactCallback'] = callback;
		}
	}

	return { // public interface
		getWorld : function() {
			createWorld();
			assert(world, "No physics world created!");
			return world;
		},
		createWorldBorder : function(params) {
			createWorldBorder(params);
		},
		getContactProcessor : function() {
			return contactProcessor;
		},
		getContactListener : function() {
			return contactListener;
		},
		updateWorld : function(delta) {

			if (pause)
				return;

			var world = this.getWorld();

			world['Step'](delta / 1350, 50);
			// this.getWorld().Step(delta / 1000 * (1.0), 20);
			// this.getWorld().Step(delta / 1000 * (0.00), 20);
			if (timeout)
				timeout.tick(delta);

			if (debugCanvas) {
				debugDraw();
			}

			//contactListener.update();

			for ( var i = 0; i < updateItems.length; ++i)
				updateItems[i].updatePhysics();
		},
		createSphere : function(x, y, radius, localPosition) {
			var sphereSd = new b2CircleDef();
			setupShapeDef(sphereSd);

			sphereSd['radius'] = radius;
			var body = createBody(x, y, 0, sphereSd);
			if (localPosition) {
				body['GetShapeList']()['m_localPosition']['Set'](
						localPosition.x, localPosition.y);
				body.setPoseByShape({
					x : x,
					y : y
				}, 0);
			}
			return body;
		},
		createBox : function(x, y, angle, width, height, fixed) {
			if (typeof (fixed) == 'undefined')
				fixed = true;
			var boxSd = new b2BoxDef();
			if (!fixed)
				setupShapeDef(boxSd);

			boxSd['extents']['Set'](width / 2, height / 2);
			return createBody(x, y, angle, boxSd);
		},
		createPoly : function(x, y, vertices, fixed) {
			var polySd = createPolyDef(vertices, fixed);
			return createBody(x, y, 0, polySd);
		},
		createPolyComposite : function(x, y, angle, poligons, localPosition,
				fixed) {
			poligonsDefs = [];
			for ( var i = 0; i < poligons.length; ++i)
				poligonsDefs.push(createPolyDef(poligons[i], localPosition,
						fixed));
			var output = createBody(x, y, angle, poligonsDefs,
					poligonsDefs.length);
			output.m_userData = {
				"id" : "Ground01",
				"params" : {
					"type" : "Ground"
				}
			};
			return output;
		},
		destroy : function(physics) {
			if (!physics)
				return;
			assert(world);
			world['DestroyBody'](physics);
		},
		destroyWorld : function() {
			Physics.destroy(worldBorder);
			world = null;
			updateItems = [];
		},
		getWorldBorder : function() {
			if (!worldBorder)
				createWorld();
			assert(worldBorder);
			return worldBorder;
		},
		pause : function(v) {
			if (v == null)
				pause = !pause;
			else
				pause = v;
		},
		paused : function() {
			return pause;
		},
		resetTimeout : function(addTime) {
			if (!timeout)
				return;
			timeout.timeOut += addTime;
		},
		clearTimeout : function() {
			timeout = null;
		},
		setTimout : function(callback, time) {
			timeout = {
				time : 0,
				callback : callback,
				timeOut : time,
				tick : function(delta) {
					this.time += delta;
					if (this.time < this.timeOut)
						return;
					this.callback();
					timeout = null;
				}
			};
		},
		updateItemAdd : function(entity) {
			var idx = updateItems.indexOf(entity);
			if (idx == -1)
				updateItems.push(entity);
		},
		updateItemRemove : function(entity) {
			var idx = updateItems.indexOf(entity);
			if (idx != -1)
				updateItems.splice(idx, 1);
		},
		destroy : function(entity) {
			if (!entity)
				return;
			Physics.updateItemRemove(entity);
			if (world && entity.physics)
				world['DestroyBody'](entity.physics);
		},
		debugDrawing : function(trueOrFalse) {
			debugDrawing(trueOrFalse);
		},
		debugDrawingIsOn : function(trueOrFalse) {
			return !!debugCanvas;
		},
		setDebugModeEnabled : function(trueOrFalse) {
			debugMode = trueOrFalse;
		},
		debugMode : function() {
			return debugMode;
		},
		explode : function() {
			
		}
	};
})();

//
/*
 * if (callbacks.BeginContact) listener.BeginContact = function(contact) {
 * callbacks.BeginContact(contact.GetFixtureA().GetBody().GetUserData(),
 * contact.GetFixtureB().GetBody().GetUserData()); } if (callbacks.EndContact)
 * listener.EndContact = function(contact) {
 * callbacks.EndContact(contact.GetFixtureA().GetBody().GetUserData(),
 * contact.GetFixtureB().GetBody().GetUserData()); } if (callbacks.PostSolve)
 * listener.PostSolve = function(contact, impulse) {
 * callbacks.PostSolve(contact.GetFixtureA().GetBody().GetUserData(),
 * contact.GetFixtureB().GetBody().GetUserData(), impulse.normalImpulses[0]); }
 * this.world.SetContactListener(listener);
 */

var collisionCallback = function() {
	var entity1 = contact.GetFixtureA().GetBody().GetUserData();
	var entity2 = contact.GetFixtureB().GetBody().GetUserData();
	var material1 = entity1.descriptions.material;
	var material2 = entity2.descriptions.material;

	/*
	 * MaterialImpact : { sound particles object1Damage }
	 * 
	 * 
	 */
	var materialImpact = Physics.getMaterialImpact(material1, material2);

	if (entity1.beginContact) {
		entity1.beginContact(entity2, materialImpact);
	}
	if (entity2.beginContact) {
		entity12.beginContact(entity1, materialImpact);
	}

	// position
	if (materialImpact.effect) {
		var effect = new VisualEffect(materialImpact.effect);
	}
};


