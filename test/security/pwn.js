(function(){
  var message = 'Ya been pwned by an XSS from an unsanitized script tag injection.';
  if(alertify){
    alertify.error(message);
  } else {
    alert(message);
  };
})();
