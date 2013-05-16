/*WebSound*/
var WebSound = function(context) {
	this.context = context;
	this.volume = 1;
	this.fade = false;
};

WebSound.prototype.play = function(sndInst, callback) {
	var that = this;
	var source = this.context.createBufferSource();
	sndInst.source = source;
	sndInst.source.connect(this.context.destination);
//	console.log("SOUND BUFF", sndInst.buffer);
	sndInst.source.buffer = sndInst.buffer;
	sndInst.source.loop = sndInst.loop;
	sndInst.source.gain.value = sndInst.volume;
	sndInst.source.noteGrainOn(0, sndInst.offset, sndInst.duration);
	var buf = sndInst.buffer;
	if (!sndInst.loop) {
		this.playTimeout = setTimeout(function() {
			sndInst.source = that.context.createBufferSource();
			sndInst.source.buffer = buf;
			if (callback) {
				callback();
			}
		}, sndInst.duration * 1000);
	}
};

WebSound.prototype.stop = function(sndInst) {
	if (sndInst) {
		sndInst.source.noteOff(0);
	}
};

WebSound.prototype.mute = function(channel) {
	if(channel){
		channel.playing.source.gain.value = 0;
	}else{
		this.volume = 0;
	}
};

WebSound.prototype.unmute = function(channel) {
	if(channel){
		channel.playing.source.gain.value = 1;
	}else{
		this.volume = 1;
	}
};


WebSound.prototype.fadeTo = function(sndInst, time, volume) {
	var fadeStep = 10;
	if(this.fade == sndInst.id){
		return;
	}
	this.fade = sndInst.id;
	var that = this;
	var dVol = volume - sndInst.source.gain.value;
	if(dVol == 0){
		return;
	}
	dVol /= time/fadeStep;
	if (sndInst) {
		this.fading = true;
		var int = setInterval(function(){
			if(Math.abs(sndInst.source.gain.value - volume) >= Math.abs(dVol)){
				sndInst.source.gain.value += dVol;
			}else{
				sndInst.source.gain.value = volume;
				that.fade = false;
				clearInterval(int);
			}
		},fadeStep);
	}
};

WebSound.prototype.loadSprite = function(name, callback) {
	this.loadSound(name, callback);
};

WebSound.prototype.loadSound = function(name, callback) {
	var that = this;
	
	var canPlayMp3, canPlayOgg = null;
	var myAudio = document.createElement('audio');
	if (myAudio.canPlayType) {
		canPlayMp3 = !!myAudio.canPlayType
				&& "" != myAudio.canPlayType('audio/mpeg');
		canPlayOgg = !!myAudio.canPlayType
				&& "" != myAudio.canPlayType('audio/ogg; codecs="vorbis"');
	}
	var ext;
	if(canPlayOgg) {
		ext = ".ogg";
	} else {
		ext = ".mp3";
		//this.soundOffset = this.mp3offset;
	}

	var request = new XMLHttpRequest();
	request.open('GET', name + ext, true);
	request.responseType = 'arraybuffer';
	// Decode asynchronously
	request.onload = function() {
		that.context.decodeAudioData(request.response, function(buffer) {
			var source = that.context.createBufferSource();
			source.buffer = buffer;
			if (callback) {
				callback(buffer);
			}
		}, function() {
			console.error("Unable to load sound:" + name + EXTENTION);
		});
	};
	request.send();
};
