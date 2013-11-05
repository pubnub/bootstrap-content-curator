(function(){

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// SETTINGS
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
var settings = { 
        publish_key   : 'demo'
    ,   subscribe_key : 'demo'
    ,   secret_key    : ''
    ,   channel       : 'demo'
};


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// INIT OBJECTS AND ELEMENTS
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
var pubnub                = PUBNUB.init(settings)
,   push_submit           = pubnub.$('push-submit')
,   new_headline_area     = pubnub.$('new-headline-area')
,   live_posts            = pubnub.$('live-posts')
,   push_text_area        = pubnub.$('push-text-area')
,   published_template    = pubnub.$('published-template').innerHTML
,   publish_edit_template = pubnub.$('publish-edit-template').innerHTML;


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// PUSH SUBMIT ACTION
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
PUBNUB.bind( 'mousedown,touchstart', push_submit, function() {
    var headline = push_text_area.value;
    push_text_area.value = '';
    author_action( 'new', {
        id       : PUBNUB.uuid(),
        headline : headline
    } );
} );


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// AUTHOR ACTIONS
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
function author_action( action, data ) {
    pubnub.publish({
        channel : settings.channel,
        message : {
            action : action,
            data   : data
        }
    });
}

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// RECEIVE EVENTS FOR LOTS OF DIFFERENT THINGS
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
pubnub.subscribe({
    channel : settings.channel,
    message : function(message) {
        PUBNUB.events.fire( 'message.' + message.action, message.data );
    }
});


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// CURATOR RECEIVE HEADLINE FOR PUBLISHING AND EDITING
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
PUBNUB.events.bind( 'message.new', function(data) {
    var div = PUBNUB.create('div');
    div.innerHTML = PUBNUB.supplant( publish_edit_template, data );
    new_headline_area.insertBefore( div, first_div(new_headline_area) );
} );


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// RECEIVING LIVE POSTS: STREAM FEEDER!
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
PUBNUB.events.bind( 'message.publish', function(data) {
    var previous = PUBNUB.$('published-'+data.id);
    if (previous) live_posts.removeChild(previous);
    (function() {
        var div = PUBNUB.create('div');
        div.id = 'published-'+data.id;
        live_posts.insertBefore( div, first_div(live_posts) );
        return div;
    })().innerHTML = PUBNUB.supplant( published_template, data );
} );

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// RECEIVING DELETE
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
PUBNUB.events.bind( 'message.delete', function(data) {
    var previous = PUBNUB.$('published-'+data.id);
    if (previous) live_posts.removeChild(previous);
} );


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// EDITOR
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
delegate( PUBNUB.$('new-headline-area'), 'editor' );

// PUBLISH BUTTON CLICK
PUBNUB.events.bind( 'editor.publish', function(event) {
    author_action( 'publish', {
        id       : event.data,
        headline : PUBNUB.$(event.data).innerHTML
    } );
} );

PUBNUB.events.bind( 'editor.delete', function(event) {
    author_action( 'delete', { id : event.data } );
} );


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// GET ELEMENT ACTION DATA ATTRIBUTE AND FIRE ASSOCIATED EVENT
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
function delegate( element, namespace ) {
    PUBNUB.bind( 'click', element, function(e) {
        var data   = bubblefind( e, 'data-data' )
        ,   action = bubblefind( e, 'data-action' );
        if (!action) return true;
        PUBNUB.events.fire( namespace + '.' + action.result, {
            action : action.result,
            target : action.target,
            data   : data.result
        } );
    } );
}

function bubblefind( e, attr ) {
    var target = e.target || e.srcElement || {}
    ,   result = '';
    while (target) {
        result = PUBNUB.attr( target, attr );
        if (result) return { result : result, target : target };
        target = target.parentNode;
    }
}

function first_div(elm) { return elm.getElementsByTagName('div')[0] }

})();
