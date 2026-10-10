/* 고객센터 게시판 (서버 없이 방문자 브라우저에 저장). content.js 의 board 설정을 읽습니다.
 * #board-root 요소 안에 왼쪽 메뉴와 게시판을 그립니다. */
(function(){
  var S=window.SITE||{},B=S.board,root=document.getElementById("board-root");
  if(!B||!root)return;
  var $=function(s){return document.querySelector(s)};
  var e=function(t){return String(t==null?"":t).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
  var list=function(a,fn){return (a||[]).map(fn).join("")};
  root.innerHTML='<div class="wrap about" style="padding-block:24px 56px"><aside class="about-side"><p class="h2like">'+e(B.title)+'</p><div class="ptabs" id="btabs" role="tablist">'+list(B.boards,function(b){return '<button type="button" role="tab" data-b="'+e(b.id)+'" aria-selected="'+(b.id==="inquiry")+'">'+e(b.label)+'</button>'})+'</div></aside><div class="about-main" id="board-main"></div></div>';
  var main=$("#board-main");
  (function(){
    var mem={};
    var store={get:function(k){try{var v=localStorage.getItem(k);return v==null?(k in mem?mem[k]:null):v}catch(x){return k in mem?mem[k]:null}},
      set:function(k,v){mem[k]=v;try{localStorage.setItem(k,v)}catch(x){}}};
    var st={tab:"inquiry",view:"list",page:1,sort:"new",q:"",field:"all",csort:"likes",id:null,unlocked:{},msg:"",err:""};
    var cfg=function(id){return B.boards.filter(function(b){return b.id===id})[0]};
    var load=function(id){var raw=store.get("hrc-board-"+id);if(raw){try{return JSON.parse(raw)}catch(x){}}
      var seed=JSON.parse(JSON.stringify(cfg(id).seed||[]));save(id,seed);return seed};
    var save=function(id,arr){store.set("hrc-board-"+id,JSON.stringify(arr))};
    var pad=function(n){return ("0"+n).slice(-2)};
    var today=function(){var d=new Date();return d.getFullYear()+"."+pad(d.getMonth()+1)+"."+pad(d.getDate())};
    var now=function(){var d=new Date();return today()+" "+pad(d.getHours())+":"+pad(d.getMinutes())};
    var mask=function(p){var d=String(p||"").replace(/[^0-9]/g,"");return d.length>=7?d.slice(0,3)+"****":""};
    var find=function(arr,id){return arr.filter(function(p){return p.id===id})[0]};
    var FIELDS={all:"전체",title:"제목",content:"내용",author:"작성자"};

    function matches(p){
      if(!st.q)return true;var q=st.q.toLowerCase(),t=(p.title||"").toLowerCase(),c=p.secret?"":(p.content||"").toLowerCase(),a=(p.author||"").toLowerCase();
      return st.field==="title"?t.indexOf(q)>=0:st.field==="content"?c.indexOf(q)>=0:st.field==="author"?a.indexOf(q)>=0:(t.indexOf(q)>=0||c.indexOf(q)>=0||a.indexOf(q)>=0);
    }
    function pager(page,pages){
      var g=Math.floor((page-1)/10),s=g*10+1,e2=Math.min(pages,s+9),h="";
      if(g>0)h+='<button type="button" data-pg="1">처음</button><button type="button" data-pg="'+(s-1)+'">«</button>';
      for(var i=s;i<=e2;i++)h+='<button type="button" data-pg="'+i+'"'+(i===page?' aria-current="true"':'')+'>'+i+'</button>';
      if(e2<pages)h+='<button type="button" data-pg="'+(e2+1)+'">»</button><button type="button" data-pg="'+pages+'">마지막</button>';
      return h;
    }
    function renderList(){
      var cf=cfg(st.tab),all=load(st.tab).filter(matches);
      var key={new:function(a,b){return a.date===b.date?b.id-a.id:(a.date<b.date?1:-1)},views:function(a,b){return b.views-a.views},likes:function(a,b){return (b.likes||0)-(a.likes||0)}}[st.sort];
      var sorted=all.slice().sort(key),total=sorted.length,ps=B.pageSize||10,pages=Math.max(1,Math.ceil(total/ps));
      if(st.page>pages)st.page=pages;
      var rows=sorted.slice((st.page-1)*ps,st.page*ps);
      var opts=function(o,cur){return Object.keys(o).map(function(k){return '<option value="'+k+'"'+(k===cur?" selected":"")+'>'+o[k]+'</option>'}).join("")};
      main.innerHTML=(st.msg?'<p class="btoast">'+e(st.msg)+'</p>':'')+'<h3>'+e(cf.label)+'</h3><div class="btop"><span>전체 '+total+(st.q?' (검색: '+e(st.q)+')':'')+'</span><select id="bsort" aria-label="정렬">'+opts({new:"최신순",views:"조회순",likes:"추천순"},st.sort)+'</select></div>'+
        '<table class="btbl"><thead><tr><th class="hm">번호</th><th>제목</th><th>작성자</th><th class="hm">작성일</th><th class="hm">추천</th><th class="hm">조회</th></tr></thead><tbody>'+
        (rows.length?rows.map(function(p){return '<tr><td class="hm">'+p.id+'</td><td class="t"><a data-open="'+p.id+'">'+(p.secret?'🔒 ':'')+e(p.title)+'</a>'+(p.reply?'<span class="rc">(1)</span>':'')+((p.comments||[]).length?'<span class="rc">['+p.comments.length+']</span>':'')+'</td><td>'+e(p.author)+'</td><td class="hm">'+e(String(p.date).slice(0,10))+'</td><td class="hm">'+(p.likes||0)+'</td><td class="hm">'+p.views+'</td></tr>'}).join(""):'<tr><td colspan="6">'+(st.q?'검색 결과가 없습니다.':'등록된 글이 없습니다.')+'</td></tr>')+
        '</tbody></table><div class="bpager">'+pager(st.page,pages)+'</div>'+
        '<form class="bsearch" id="bsearch"><select id="bfield" aria-label="검색 항목">'+opts(FIELDS,st.field)+'</select><input id="bq" value="'+e(st.q)+'" placeholder="검색어" aria-label="검색어"><button type="submit" class="bbtn">검색</button>'+(st.q?'<button type="button" class="bbtn" data-act="reset">전체보기</button>':'')+'</form>'+
        (cf.writable?'<div class="bright"><button type="button" class="bbtn pri" data-act="write">글쓰기</button></div>':'');
      st.msg="";
    }
    function renderPw(){
      main.innerHTML='<h3>'+e(cfg(st.tab).label)+'</h3><form class="bform" id="bpw"><p>🔒 비밀글입니다. 작성 시 입력한 비밀번호를 입력해 주세요.</p><label>비밀번호<input id="bpwin" type="password" autocomplete="off"></label>'+(st.err?'<p class="berr">'+e(st.err)+'</p>':'')+'<div><button type="submit" class="bbtn pri">확인</button><button type="button" class="bbtn" data-act="list">목록보기</button></div></form>';st.err="";
    }
    function commentsHtml(p){
      var cs=(p.comments||[]).slice();
      cs.sort(st.csort==="likes"?function(a,b){return (b.likes||0)-(a.likes||0)||b.id-a.id}:function(a,b){return b.id-a.id});
      return '<div class="bcom"><div class="btop"><span>댓글 전체 <b style="color:var(--accent)">'+cs.length+'</b></span><select id="bcsort" aria-label="댓글 정렬"><option value="likes"'+(st.csort==="likes"?" selected":"")+'>추천순</option><option value="new"'+(st.csort==="new"?" selected":"")+'>최신순</option></select></div>'+
        (cs.length?cs.map(function(c){return '<div class="bc"><div class="bcm"><b>'+e(c.author)+'</b> <span>'+e(c.date)+'</span><button type="button" class="bclike" data-clike="'+c.id+'">👍 '+(c.likes||0)+'</button></div><p>'+e(c.text)+'</p></div>'}).join(""):'<p class="meta" style="padding:10px 0">첫 댓글을 남겨 보세요.</p>')+
        '<form class="bform bcf" id="bcom"><div class="bcrow"><input id="bc-name" required maxlength="20" placeholder="이름" aria-label="이름"></div><textarea id="bc-text" rows="3" required maxlength="500" placeholder="댓글을 입력하세요" aria-label="댓글"></textarea><div><button type="submit" class="bbtn pri">댓글 등록</button></div></form></div>';
    }
    function renderView(){
      var arr=load(st.tab),p=find(arr,st.id);if(!p){st.view="list";return renderList()}
      var mine=store.get("hrc-react-"+st.tab+"-"+p.id);
      main.innerHTML=(st.msg?'<p class="btoast">'+e(st.msg)+'</p>':'')+'<div class="bview"><h3>'+e(cfg(st.tab).label)+'</h3><h4>'+(p.secret?'🔒 ':'')+e(p.title)+'</h4><div class="bmeta"><span>작성자 '+e(p.author)+'</span><span>작성일 '+e(p.date)+'</span><span>조회 '+p.views+'</span></div>'+
        (p.phone?'<p class="meta">전화번호 : '+e(mask(p.phone))+'</p>':'')+'<div class="bbody">'+e(p.content)+(p.image?'<img src="'+e(p.image)+'" alt="첨부 사진">':'')+'</div>'+
        (p.reply?'<div class="breply"><b>홈로취케어 답변</b><p style="margin-top:6px;max-width:none">'+e(p.reply)+'</p></div>':'')+
        '<div class="bact"><span><button type="button" class="bbtn react" data-react="up"'+(mine?' disabled':'')+'>좋아요 '+(p.likes||0)+'</button><button type="button" class="bbtn react" data-react="down"'+(mine?' disabled':'')+'>싫어요 '+(p.dislikes||0)+'</button></span><button type="button" class="bbtn" data-act="print">인쇄</button></div>'+
        commentsHtml(p)+
        '<div style="margin-top:14px"><button type="button" class="bbtn" data-act="list">목록보기</button>'+(p.pw&&cfg(st.tab).writable?'<button type="button" class="bbtn" data-act="del">삭제</button>':'')+'</div><form class="bform" id="bdel" hidden style="margin-top:12px"><label>비밀번호 확인<input id="bdelpw" type="password" autocomplete="off"></label><div><button type="submit" class="bbtn pri">삭제하기</button></div><p class="berr" id="bdelerr"></p></form></div>';st.msg="";
    }
    function renderWrite(){
      var cf=cfg(st.tab);
      main.innerHTML='<h3>'+e(cf.label)+' 글쓰기</h3><form class="bform" id="bwrite"><label>이름<input id="bw-name" required maxlength="20"></label><label>비밀번호 (삭제·비밀글 열람용, 4자 이상)<input id="bw-pw" type="password" required minlength="4" maxlength="30" autocomplete="new-password"></label><label>연락처<input id="bw-phone" type="tel" maxlength="20" placeholder="010-0000-0000"></label><label>제목<input id="bw-title" required maxlength="80"></label><label>내용<textarea id="bw-content" rows="8" required maxlength="3000"></textarea></label><label>사진 첨부 (선택)<input id="bw-img" type="file" accept="image/*"></label><label style="display:flex;gap:8px;align-items:center;color:var(--fg)"><input id="bw-secret" type="checkbox" style="width:auto"'+(cf.secretDefault?' checked':'')+'> 비밀글로 등록</label><p class="berr" id="bw-err"></p><div><button type="submit" class="bbtn pri">등록</button><button type="button" class="bbtn" data-act="list">취소</button></div></form>';
    }
    function render(){({list:renderList,view:renderView,write:renderWrite}[st.view]||renderList)()}
    function open(id){
      var arr=load(st.tab),p=find(arr,id);if(!p)return;st.id=id;
      if(p.secret&&!st.unlocked[st.tab+id]){st.view="pw";renderPw();return}
      p.views++;save(st.tab,arr);st.view="view";renderView();
    }
    function shrink(file,cb){
      var fr=new FileReader();fr.onload=function(){var im=new Image();im.onload=function(){var m=800,s=Math.min(1,m/Math.max(im.width,im.height)),cv=document.createElement("canvas");cv.width=Math.round(im.width*s);cv.height=Math.round(im.height*s);cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height);cb(cv.toDataURL("image/jpeg",.7))};im.onerror=function(){cb("")};im.src=fr.result};fr.onerror=function(){cb("")};fr.readAsDataURL(file);
    }
    main.addEventListener("click",function(ev){
      var t=ev.target.closest("[data-open],[data-pg],[data-act],[data-react],[data-clike]");if(!t)return;
      if(t.dataset.open){open(+t.dataset.open);return}
      if(t.dataset.pg){st.page=+t.dataset.pg;renderList();return}
      if(t.dataset.react){var arr=load(st.tab),p=find(arr,st.id);if(t.dataset.react==="up")p.likes=(p.likes||0)+1;else p.dislikes=(p.dislikes||0)+1;save(st.tab,arr);store.set("hrc-react-"+st.tab+"-"+p.id,"1");renderView();return}
      if(t.dataset.clike){var arr2=load(st.tab),p2=find(arr2,st.id),c=(p2.comments||[]).filter(function(x){return x.id===+t.dataset.clike})[0];
        if(c&&!store.get("hrc-clike-"+st.tab+"-"+p2.id+"-"+c.id)){c.likes=(c.likes||0)+1;save(st.tab,arr2);store.set("hrc-clike-"+st.tab+"-"+p2.id+"-"+c.id,"1");renderView()}return}
      var a=t.dataset.act;
      if(a==="list"){st.view="list";renderList()}
      else if(a==="write"){st.view="write";renderWrite()}
      else if(a==="reset"){st.q="";st.field="all";st.page=1;renderList()}
      else if(a==="print"){try{window.print()}catch(x){}}
      else if(a==="del"){var f=$("#bdel");f.hidden=!f.hidden;if(!f.hidden)$("#bdelpw").focus()}
    });
    main.addEventListener("change",function(ev){
      if(ev.target.id==="bsort"){st.sort=ev.target.value;st.page=1;renderList()}
      else if(ev.target.id==="bcsort"){st.csort=ev.target.value;renderView()}
    });
    main.addEventListener("submit",function(ev){
      ev.preventDefault();var f=ev.target.id;
      if(f==="bsearch"){st.field=$("#bfield").value;st.q=$("#bq").value.trim();st.page=1;renderList()}
      else if(f==="bpw"){var arr=load(st.tab),p=find(arr,st.id);
        if($("#bpwin").value===p.pw){st.unlocked[st.tab+st.id]=true;open(st.id)}else{st.err="비밀번호가 일치하지 않습니다.";renderPw()}}
      else if(f==="bcom"){var arr3=load(st.tab),p3=find(arr3,st.id);p3.comments=p3.comments||[];
        p3.comments.push({id:p3.comments.reduce(function(m,x){return Math.max(m,x.id)},0)+1,author:$("#bc-name").value.trim(),text:$("#bc-text").value.trim(),date:now(),likes:0});
        save(st.tab,arr3);st.msg="댓글이 등록되었습니다.";renderView()}
      else if(f==="bdel"){var arr4=load(st.tab),p4=find(arr4,st.id);
        if($("#bdelpw").value===p4.pw){save(st.tab,arr4.filter(function(x){return x.id!==p4.id}));st.view="list";st.msg="글이 삭제되었습니다.";renderList()}else{$("#bdelerr").textContent="비밀번호가 일치하지 않습니다."}}
      else if(f==="bwrite"){
        var go=function(img){var arr5=load(st.tab),id=arr5.reduce(function(m,x){return Math.max(m,x.id)},0)+1;
          arr5.push({id:id,title:$("#bw-title").value.trim(),author:$("#bw-name").value.trim(),date:now(),views:0,likes:0,dislikes:0,secret:$("#bw-secret").checked,pw:$("#bw-pw").value,phone:$("#bw-phone").value.trim(),content:$("#bw-content").value.trim(),image:img||"",reply:null,comments:[]});
          save(st.tab,arr5);st.view="list";st.page=1;st.sort="new";st.q="";st.msg="글이 등록되었습니다.";renderList()};
        var file=$("#bw-img").files[0];if(file)shrink(file,go);else go("");
      }
    });
    $("#btabs").addEventListener("click",function(ev){
      var b=ev.target.closest("button[data-b]");if(!b)return;
      st.tab=b.dataset.b;st.view="list";st.page=1;st.sort="new";st.q="";st.field="all";
      document.querySelectorAll("#btabs button").forEach(function(x){x.setAttribute("aria-selected",x===b?"true":"false")});renderList();
    });
    renderList();
  })();
})();
