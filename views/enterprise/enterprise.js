document.querySelectorAll('.ent-tile').forEach(function(tile){
  tile.addEventListener('click', function(){
    var wasExpanded = tile.classList.contains('is-expanded');
    document.querySelectorAll('.ent-tile.is-expanded').forEach(function(t){t.classList.remove('is-expanded')});
    if(!wasExpanded) tile.classList.add('is-expanded');
  });
});
