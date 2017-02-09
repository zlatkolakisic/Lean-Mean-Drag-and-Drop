//object assign polyfill
if (typeof Object.assign != 'function') {
    Object.assign = function (target) {
        'use strict';
        if (target == null) {
            throw new TypeError('Cannot convert undefined or null to object');
        }
        target = Object(target);
        for (var index = 1; index < arguments.length; index++) {
            var source = arguments[index];
            if (source != null) {
                for (var key in source) {
                    if (Object.prototype.hasOwnProperty.call(source, key)) {
                        target[key] = source[key];
                    }
                }
            }
        }
        return target;
    };
}
//nodelist foreach hack
if (typeof (NodeList.prototype.forEach) === 'undefined') {
    NodeList.prototype.forEach = Array.prototype.forEach;
}

///todo: gracefull finish, interactivity classes, touch support, wrappping it up, event triggering, vuejs app (layoutbuilder),embed options

//scroll controller
/**
 * Creates a scroll controller object
 * @constructor
 */
var scrollControl = function () {
    var nested = false, container = false, scrollSpeed = false, action = false, rect = false;
    var timeoutVar, reh, veh1, veh2, rew, vew1, vew2, cspy, cspx, cmpy, cmpx, asm, mspy, mspx;
    var setContainer = function (el) {
        if (document.body.contains(el)) {
            var vScroll = false, hScroll = false, cStyle = window.getComputedStyle(el, null);
            if (el.offsetWidth > el.clientWidth && el.clientWidth > 0) {
                var borderWidth = parseInt(cStyle.getPropertyValue('border-right-width'),10) + parseInt(cStyle.getPropertyValue('border-left-width'),10);
                vScroll = (el.offsetWidth > el.clientWidth + borderWidth);
            }
            if (el.offsetHeight > el.clientHeight && el.clientHeight > 0) {
                var borderHeight = parseInt(cStyle.getPropertyValue('border-right-height'),10) + parseInt(cStyle.getPropertyValue('border-left-height'),10);
                hScroll = (el.offsetHeight > el.clientHeight + borderHeight);
            }
            return (vScroll || hScroll) ? el : setContainer(el.parentNode);
        }
        return (document.documentElement);
    };
    var newEvent = function (e) {
        cmpy = (nested) ? e.clientY - rect.top : e.clientY;
        cmpx = (nested) ? e.clientX - rect.left : e.clientX;
        updateVars();
        scroll();
    };
    var updateVars = function () {
        reh = container.scrollHeight;//real element height
        veh1 = container.clientHeight;//visible element height without scroll bar
        veh2 = (nested) ? container.offsetHeight : window.innerHeight; //visible element height including scroll bar
        rew = container.scrollWidth;//real element width
        vew1 = container.clientWidth;//visible element width without scroll bar
        vew2 = (nested) ? container.offsetWidth : window.innerWidth;// visible element width including scroll bar
        cspy = (nested) ? container.scrollTop : window.pageYOffset;//current scroll point on Y axis
        cspx = (nested) ? container.scrollLeft : window.pageXOffset;//current scroll point on X axis
        asm = 20 / window.devicePixelRatio;//scroll margin (adjusted to the browser zoom level)
        mspy = reh - veh1;//maximum scroll point on Y axis
        mspx = rew - vew1;//maximum scroll point on X axis
        scrollSpeed = (Math.max(asm - cmpx, asm - cmpy, cmpx + asm - vew1, cmpy + asm - veh1));//distance between cursor and scroll margin
    };
    var scroll = function () {
        clearTimeout(timeoutVar);
        action = false;
        if ((cspx > 0) && (cmpx <= asm)) {//left
            action = true;
            (nested) ? container.scrollLeft -= scrollSpeed : window.scrollTo(cspx - scrollSpeed, cspy);
        }
        if ((rew > vew2) && (cspx < mspx) && (cmpx + asm >= vew1)) {//right
            action = true;
            (nested) ? container.scrollLeft += scrollSpeed : window.scrollTo(cspx + scrollSpeed, cspy);
        }
        if ((cspy > 0) && (cmpy <= asm)) {//top
            action = true;
            (nested) ? container.scrollTop -= scrollSpeed : window.scrollTo(cspx, cspy - scrollSpeed);
        }
        if ((reh > veh2) && (cspy < mspy) && (cmpy + asm >= veh1)) {//bottom
            action = true;
            (nested) ? container.scrollTop += scrollSpeed : window.scrollTo(cspx, cspy + scrollSpeed);
        }
        if (action) {
            updateVars();
            timeoutVar = setTimeout(scroll, 16);
        }
    };
    var eventHandler = function(e){
        container = setContainer(e.target);
        rect = container.getBoundingClientRect();
        nested = (container !== document.documentElement);
        newEvent(e);
    }
    return {
        update:function(e){
            eventHandler(e);
        }
    };
};
var lmdd = (function () {
    var options = {
        containerClass: false,
        fixedItemClass: false,//fixed items can't be draggable
        draggableItemClass: false,
        handleClass: false,
        regulateMouseOver: false,
        mirrorMaxHeight: 100,
        mirrorMaxWidth: 300,
        revert: false,
        dragstartTimeout: 50,
        calcInterval: 200,
        nativeScroll: false,
        protectedProperties: ['padding', 'padding-top', 'padding-bottom', 'padding-right', 'padding-left', 'display', 'list-style-type', 'line-height'],
        matchObject: false
    };
    var scrollController = new scrollControl();
    var protectedProperties = ['padding', 'padding-top', 'padding-bottom', 'padding-right', 'padding-left', 'display', 'list-style-type', 'line-height'];
    var calcInterval = null;
    var scroll = {
        lastX: window.pageXOffset,
        lastY: window.pageYOffset,
        get deltaX() {
            return window.pageXOffset - this.lastX;
        },
        get deltaY() {
            return window.pageYOffset - this.lastY;
        }
    };
    var dragOffset = {
        x: 0,
        y: 0
    };
    var scope = {};//html element in which drag event occurs
    var draggedElement = false;//html element being dragged
    var draggedClone = false;//clone of dragged element (used to animate movement)
    var mirror = false;//clone of dragged element attached to mouse cursor while dragging
    var events = {
        last: null,
        tick: null
    };
    var positions = {
        currentTarget: false,
        originalContainer: false,
        originalNextSibling: false,
        currentContainer: false,
        previousContainer: false,
        currentCoordinates: false,
        currentPosition: false,
        previousPosition: false
    };
    var dragEvent = false;
    var todo = {
        executeTask : function(batch){
            todo[batch].forEach(function(fn){
                fn();
            });
            todo[batch] = [];
        },
        onDragEnd : [],
        onNextAppend: [],
        onAppKill: []
    };
    var updateOriginalPosition = function () {
        positions.originalContainer = draggedElement.parentNode;
        positions.originalNextSibling = draggedElement.nextSibling;
    };
    var updateCurrentContainer = function () {
        positions.previousContainer = positions.currentContainer;
        if (positions.currentTarget !== events.last.target) {
            positions.currentTarget = events.last.target;
            positions.currentContainer = getWrapper(events.last.target, 'lmdd-container');
        }
    };
    var updateCurrentCoordinates = function () {
        if (positions.currentContainer) {
            positions.currentCoordinates = getCoordinates(positions.currentContainer);
        }
        else {
            positions.currentCoordinates = getCoordinates(positions.originalContainer);
        }
    };
    var updateCurrentPosition = function () {
        positions.previousPosition = positions.currentPosition;
        if (positions.currentContainer) {
            positions.currentPosition = getPosition(positions.currentCoordinates, events.last.clientY, events.last.clientX);
        }
        else {
            positions.currentPosition = false;
        }
    };
    var appendDraggedElement = function () {
        if ((positions.currentContainer)&&(acceptDrop(positions.currentContainer,draggedElement))) {
            positions.currentContainer.insertBefore(draggedElement, positions.currentContainer.childNodes[positions.currentPosition]);
            todo.executeTask('onNextAppend');
        }
        else {
            if (scope.lmddOptions.revert){
                positions.originalContainer.insertBefore(draggedElement, positions.originalNextSibling);
            }
        }
        updateCurrentCoordinates();
        animateElement(scope);
    };
    var acceptDrop = function(container,item){
        if(item.contains(container)){
            return false;
        }
        if (container.classList.contains('lmdd-dispatcher')){
            return false;
        }
        if (scope.lmddOptions.matchObject){
            var cType = container.dataset.containerType || false;
            var iType = item.dataset.itemType || false;
            return ((cType) ? ((iType) ? scope.lmddOptions.matchObject [cType][iType] : scope.lmddOptions.matchObject[cType]['default']) : scope.lmddOptions.matchObject['default']);
        }
        return true;
    };
    // helper functions
    var toggleClass = function (el, className,  action, undo){
        (action) ? el.classList.add(className) : el.classList.remove(className);
        if(undo){
            todo[undo].push(function(){(action) ? el.classList.remove(className) : el.classList.add(className)});
        }
    };
    var toggleEvent = function (el, listener, fn, useCapture, undo){
        el.addEventListener(listener, fn, useCapture);
        todo[undo].push(function(){el.removeEventListener(listener, fn, useCapture);});
    };
    var cleanNode = function (node) {//clean empty nodes
        for (var n = 0; n < node.childNodes.length; n++) {
            var child = node.childNodes[n];
            if (
                child.nodeType === 8 ||
                (child.nodeType === 3 && !/\S/.test(child.nodeValue))
            ) {
                node.removeChild(child);
                n--;
            } else if (child.nodeType === 1) {
                cleanNode(child);
            }
        }
    };
    var getOffset = function (el1, el2) {//todo:double check on IE
        var rect1 = el1.getBoundingClientRect(),
            rect2 = el2.getBoundingClientRect();
        var borderWidth = {
            left: parseInt(window.getComputedStyle(el2, null).getPropertyValue('border-left-width'),10),
            top: parseInt(window.getComputedStyle(el2, null).getPropertyValue('border-top-width'),10)
        };
        return {
            x: rect1.left - rect2.left - borderWidth.left,
            y: rect1.top - rect2.top - borderWidth.top
        };
    };
    var getWrapper = function (el, wrapperClass) {
        var path = [];
        var wrapper = false;
        for (; el && el !== document; el = el.parentNode) {
            path.unshift(el);
            if ((el.classList.contains(wrapperClass)) && (!wrapper)) {
                wrapper = el;
            }
        }
        return (path.indexOf(scope) > -1) ? wrapper : false;
    };
    var setElementIndex = function (el, isRoot) {
        el.dataset.lmddindex = (isRoot) ? 'root' : getIndex(el);
        el.childNodes.forEach(function (node) {
            setElementIndex(node, false);
        });
    };
    var deleteReference = function (el) {
        delete(el.cloneRef);
        delete(el.original);
        el.childNodes.forEach(function (node) {
            deleteReference(node);
        });
    };
    var getIndex = function (el) {
        var index = [];
        while (el.dataset.lmddindex !== 'root') {
            index.unshift(Array.prototype.indexOf.call(el.parentNode.childNodes, el));
            el = el.parentElement;
        }
        return index;
    };
    var animateElement = function (el) {
        if (el.nodeType === 1) {
            animateNode(el);
            if (el.classList.contains('lmdd-container') || (el === scope)) {
                if (el !== draggedElement) {
                    el.cloneRef.style.display = 'block';
                    el.cloneRef.style.padding = 0;
                    el.childNodes.forEach(function (node) {
                        animateElement(node);
                    });
                }
            }
        }
    };
    var animateNode = function (elNode) {
        var cloneNode = elNode.cloneRef;
        var elRect = elNode.getBoundingClientRect();
        var offset;
        cloneNode.style.position = 'absolute';
        cloneNode.style.width = (elRect.width) + 'px';
        cloneNode.style.height = (elRect.height) + 'px';
        cloneNode.style.margin = 0;
        if (elNode === scope) {
            cloneNode.style.top = elRect.top + window.pageYOffset + 'px';
            cloneNode.style.left = elRect.left + window.pageXOffset + 'px';
        } else {
            offset = (elNode === draggedElement) ? getOffset(elNode, scope) : getOffset(elNode, elNode.parentNode);
            cloneNode.style.transform = 'translate3d(' + offset.x + 'px, ' + offset.y + 'px,0px)';
            //todo: depends on animation option (translate3d,topleft,translate2d)
            // cloneNode.style.top =  offset.y + 'px';
            // cloneNode.style.left = offset.x + 'px';
        }
    };
    // var getElement = function (index, root) {
    //     var el = root;
    //     for (var i = 0; i < index.length; i++) {
    //         el = el.childNodes[index[i]];
    //     }
    //     return el;
    // };
    var getCoordinates = function (el) {
        var coordinates = [];
        el.childNodes.forEach(function (node, index) { //replace with getelementbyclassname
            if (node.nodeType === 1) {
                var coordinate = node.getBoundingClientRect();
                coordinate.index = index;
                if (!node.classList.contains('fixed')) {
                    coordinates.push(coordinate);
                }
            }
        });
        return coordinates;
    };
    var getPosition = function (coordinates, top, left) {
        var length = coordinates.length;
        if (length === 0) {
            return null
        }
        var lastAbove = 0;
        var firstBelow = 0;
        var position = -1;
        for (; lastAbove <= length; lastAbove++) {
            if (lastAbove === length) {
                lastAbove--;
                break;
            } else if (coordinates[lastAbove].bottom > top) {
                lastAbove--;
                break;
            }
        }
        for (; firstBelow <= length; firstBelow++) {
            if (firstBelow === length) {
                break;
            } else if (coordinates[firstBelow].top > top) {
                break;
            }
        }
        var firstRight = lastAbove + 1;
        for (; firstRight <= firstBelow; firstRight++) {
            if (firstRight === firstBelow) {
                position = firstRight;
                break;
            } else if (coordinates[firstRight].left > left) {
                position = firstRight;
                break;
            }
        }
        if (position === length) {
            return coordinates[position - 1].index + 1;
        }
        return coordinates[position].index;
    };
    var dragStarted = function () {
        scroll.lastX = window.pageXOffset;
        scroll.lastY = window.pageYOffset;
        setAnimationLayer();
        setDraggedClone();
        animateElement(scope);//take care of positioning
        setMirror();//reverseVV
        toggleClass(scope,'hidden-layer',true,'onDragEnd');
        toggleClass(scope.cloneRef,'visible-layer',true,'onDragEnd');
    };
    var setDraggedClone = function () {
        draggedClone = draggedElement.cloneRef;//use a copy of the dragged element to act as shadow/ghost
        var cStyle = (window.getComputedStyle) ? window.getComputedStyle(draggedElement, null) : draggedElement.currentStyle;
        for (var i = 0; i < protectedProperties.length; i++) {
            draggedClone.style[protectedProperties[i]] = cStyle[protectedProperties[i]];
        }
        draggedClone.classList.add('lmdd-dragged');//reverse
        draggedClone.classList.remove('lmdd-hidden');//reverse
        scope.cloneRef.appendChild(draggedClone);//insert the shadow into the dom
    };
    var updateMirrorLocation = function () {
        mirror.style.top = (events.last.pageY - parseInt(mirror.parentNode.style.top,10) + scroll.deltaY - dragOffset.y) + 'px';
        mirror.style.left = (events.last.pageX - parseInt(mirror.parentNode.style.left,10) + scroll.deltaX - dragOffset.x) + 'px';
    };
    var setMirror = function () {
        mirror = draggedClone.cloneNode(true);
        mirror.classList.add('lmdd-mirror');
        mirror.classList.remove('lmdd-dragged');
        mirror.style.width = draggedClone.getBoundingClientRect().width + 'px';
        mirror.style.height = draggedClone.getBoundingClientRect().height + 'px';
        var minHeight = 100;
        var maxWidth = 500;
        var scaleX = maxWidth / draggedClone.getBoundingClientRect().width;
        var scaleY = minHeight / draggedClone.getBoundingClientRect().height;
        var scale = Math.min(1, Math.max(scaleX, scaleY));
        dragOffset.x *= scale;
        dragOffset.y *= scale;
        mirror.style.transform = 'scale(' + scale + ',' + scale + ')';
        mirror.style.transformOrigin = '0 0';
        scope.cloneRef.appendChild(mirror);
        todo.onDragEnd.push(function(){
            // scope.cloneRef.removeChild(mirror);
            mirror = false;
        });
        updateMirrorLocation();
    };
    var createReference = function (el, clone) {
        var elArray = [];
        var cloneArray = [];
        var traverse = function (el, refArray) {
            refArray.push(el);
            el.childNodes.forEach(function (node) {
                traverse(node, refArray);
            });
        };
        traverse(el, elArray);
        traverse(clone, cloneArray);
        for (var i = 0; i < elArray.length; i++) {
            elArray[i].cloneRef = cloneArray[i];
            elArray[i].original = true;
        }
    };
    var muteEvent = function (event) {
        event.preventDefault();
        event.stopPropagation();
        return false;
    };
    var setAnimationLayer = function () {
        var clone = scope.cloneNode(true);
        clone.id += '-lmddClone';
        createReference(scope, clone);//create a clone reference for every element on scope
        scope.parentNode.appendChild(scope.cloneRef); //insert the clone into the dom
        todo.onDragEnd.push(function(){
            scope.parentNode.removeChild(scope.cloneRef);
            deleteReference(scope);
        })
    };
    var setDraggables = function (el) {
        var containers = el.getElementsByClassName(el.lmddOptions.containerClass);
        if (el.classList.contains(el.lmddOptions.containerClass)) {
            toggleClass(el,'lmdd-container',true,'onAppKill');
        }
        for (var i = 0; i < containers.length; i++) {
            toggleClass(containers[i],'lmdd-container',true,'onAppKill');
        }
        var draggables = el.getElementsByClassName(el.lmddOptions.draggableItemClass);
        for (i = 0; i < draggables.length; i++) {
            toggleClass(draggables[i],'lmdd-draggable',true,'onAppKill');
        }
    };
    var killEvent = function () {
        if (dragEvent) {
            todo.executeTask('onDragEnd');
        }
        scope = false;
        dragEvent = false;
        draggedElement = false;
        draggedClone = false;
        events.last = false;
    };
    var eventTicker = function () {
        if (!scope.lmddOptions.nativeScroll) {
            scrollController.update(events.last)
        }
        if (events.tick === events.last) {
            return false;
        }
        events.tick = events.last;
        updateCurrentContainer();
        if (!positions.currentContainer) {//no container found
            if (positions.previousContainer && scope.lmddOptions.revert) {//execute once (revert)
                appendDraggedElement();
            }
        }
        else {//found a container
            if (positions.currentContainer !== positions.previousContainer) {//its a new one...
                updateCurrentCoordinates();
                updateCurrentPosition();
                appendDraggedElement();
            }
            else {//same container
                updateCurrentPosition();
                if (positions.currentPosition !== positions.previousPosition) {//new position
                    appendDraggedElement();
                }
            }
        }
    };
    var eventManager = function (event) {
        if (event.type === 'mouseup') {
            killEvent();
            return false;
        }
        if ((event.button !== 0) && (event.type !== 'scroll')) {
            killEvent();
            return false;
        }
        if (event.type === 'mousemove') {
            events.last = event;
            scroll.lastX = window.pageXOffset;
            scroll.lastY = window.pageYOffset;
            updateMirrorLocation();
        }
        if (event.type === 'scroll') {
            updateMirrorLocation();
            updateCurrentCoordinates();
        }
        if (event.type === 'mousedown') {
            scope = this;
            events.last = event;
            window.setTimeout(function () {//delay the dragstart for a short time to enable clicking and text selection
                if ((events.last) && (window.getSelection().anchorOffset === window.getSelection().focusOffset)) {
                    if ((scope.lmddOptions.handleClass) && (!event.target.classList.contains(scope.lmddOptions.handleClass))) {//not dragging with handle
                        killEvent();
                        return false;
                    }
                    var target = getWrapper(event.target, 'lmdd-draggable');
                    if (!target) {//not dragging a draggable
                        killEvent();
                        return false;
                    }
                    else if (!dragEvent) {
                        if (!scope.lmddOptions.nativeScroll){
                            event.preventDefault();//disable native scrolling on mouse down
                        }
                        if (target.classList.contains('lmdd-clonner')){
                            scope.cloned = target.parentNode.insertBefore(target.cloneNode(true),target);
                            target.classList.remove('lmdd-clonner');
                            todo.onAppKill.push(function(){
                                scope.cloned.classList.remove('lmdd-draggable');
                                scope.cloned.classList.remove('lmdd-container');
                            });
                            toggleClass(scope.cloned,'no-display',true,'onNextAppend');
                            todo.onNextAppend.push(function(){
                                toggleClass(scope.cloned.cloneRef,'no-display',false);
                                toggleClass(scope.cloned.cloneRef,'no-transition',true ,'onDragEnd');
                                updateOriginalPosition();
                            });
                        }
                        draggedElement = target;
                        dragEvent = true;
                        updateOriginalPosition();
                        window.getSelection().removeAllRanges();//disable selection on FF and IE - JS
                        toggleClass(document.body,'unselectable',true,'onDragEnd');
                        toggleClass(draggedElement,'lmdd-hidden',true,'onDragEnd');
                        dragOffset.x = event.clientX - target.getBoundingClientRect().left;
                        dragOffset.y = event.clientY - target.getBoundingClientRect().top;
                        dragStarted();
                        toggleEvent(document , 'mousemove', eventManager , false, 'onDragEnd');
                        toggleEvent(document , 'scroll', eventManager , false, 'onDragEnd');
                        if (document.body.setCapture) {
                            document.body.setCapture(false);
                            todo.onDragEnd.push(function(){
                                document.releaseCapture();
                            });
                        }
                        calcInterval = window.setInterval(eventTicker, scope.lmddOptions.calcInterval);//calculation interval for mouse movement
                        todo.onDragEnd.push(function(){
                            clearInterval(calcInterval);
                            calcInterval = null;
                        });
                    }
                }
            }, scope.lmddOptions.dragstartTimeout);
        }
    };
    return {
        init: function (el, lmddOptions) {
            if (!el.lmdd) {
                cleanNode(el);//get rid of whitespaces
                el.lmdd = true;
                el.lmddOptions = Object.assign({}, options, lmddOptions);//create options object
                setDraggables(el);
                toggleEvent(el,'mousedown',eventManager,false,'onAppKill');
                toggleEvent(window,'mouseup',eventManager,false,'onAppKill');
                toggleEvent(document,'drag',muteEvent,false,'onAppKill');
                toggleEvent(document,'dragstart',muteEvent,false,'onAppKill');
            }
        },
        kill: function (el) {
            if (el.lmdd) {
                todo.executeTask('onAppKill');
                el.lmdd = false;
                delete(el.lmddOptions);
            }
        }
    };
})();
