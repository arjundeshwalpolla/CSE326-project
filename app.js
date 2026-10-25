const $ = id => document.getElementById(id);
const slotNames = ["6:00 AM - 6:45 AM","6:45 AM - 7:30 AM","7:30 AM - 8:15 AM","8:15 AM - 9:00 AM","4:00 PM - 4:45 PM","4:45 PM - 5:30 PM","5:30 PM - 6:15 PM","6:15 PM - 7:00 PM","7:15 PM - 8:00 PM"];
let selectedSlot = "";
let adminLoggedIn = false;
const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset()*60000).toISOString().slice(0,10);
$("date").min = localToday; $("date").value = localToday;
$("due").min = new Date(Date.now()+60000).toISOString().slice(0,16);

async function api(url, options={}) {
  const res = await fetch(url, { ...options, headers: { "Content-Type":"application/json", ...(options.headers||{}) }});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function capacity(f){return f.includes("Badminton")?4:f.includes("Table Tennis")?6:f.includes("Gym")?12:10;}
async function getPublicBookings(){return (await api("/api/bookings")).bookings;}
async function renderSlots(){
  const facility=$("facility").value,date=$("date").value;
  const all=await getPublicBookings();
  $("slots").innerHTML="";
  for(const slot of slotNames){
    const used=all.filter(b=>b.facility===facility&&b.date===date&&b.slot===slot).length;
    const btn=document.createElement("button");
    btn.type="button";btn.className="slot"+(selectedSlot===slot?" selected":"");
    btn.textContent=`${slot} · ${Math.max(0,capacity(facility)-used)} left`;
    btn.disabled=used>=capacity(facility);
    btn.onclick=()=>{selectedSlot=slot;renderSlots().catch(showError);};
    $("slots").appendChild(btn);
  }
  renderAvailability(all);
}
function renderAvailability(all){
  const facility=$("facility").value,date=$("date").value;
  $("availability").innerHTML=slotNames.map(slot=>{
    const used=all.filter(b=>b.facility===facility&&b.date===date&&b.slot===slot).length;
    return `<div class="availcard"><b>${esc(slot)}</b><span>${Math.max(0,capacity(facility)-used)} spaces available</span></div>`;
  }).join("");
}
function showError(err){alert(err.message||String(err));}
$("facility").onchange=()=>{selectedSlot="";renderSlots().catch(showError);};
$("date").onchange=()=>{selectedSlot="";renderSlots().catch(showError);};

$("bookingForm").onsubmit=async e=>{
  e.preventDefault();
  if(!selectedSlot){alert("Please select a time slot.");return;}
  try{
    const booking=(await api("/api/bookings",{method:"POST",body:JSON.stringify({
      name:$("student").value.trim(),roll:$("roll").value.trim(),
      facility:$("facility").value,date:$("date").value,slot:selectedSlot
    })})).booking;
    $("confirmation").innerHTML=`<div class="result"><h3>✓ Booking confirmed</h3><p><b>Booking ID:</b> ${esc(booking.id)}</p><p><b>Student:</b> ${esc(booking.name)}</p><p><b>Roll number:</b> ${esc(booking.roll)}</p><p><b>Facility:</b> ${esc(booking.facility)}</p><p><b>Date:</b> ${esc(booking.date)}</p><p><b>Time:</b> ${esc(booking.slot)}</p><p>Your booking has been saved to the server.</p></div>`;
    selectedSlot="";await renderSlots();
    if(adminLoggedIn)await refreshDashboard();
  }catch(err){showError(err);await renderSlots();}
};

$("equipmentForm").onsubmit=async e=>{
  e.preventDefault();
  try{
    await api("/api/equipment",{method:"POST",body:JSON.stringify({roll:$("eqRoll").value.trim(),item:$("eqItem").value,due:$("due").value})});
    $("equipmentMessage").innerHTML='<div class="result">Equipment borrowing has been registered.</div>';
    e.target.reset();
    if(adminLoggedIn)await refreshDashboard();
  }catch(err){showError(err);}
};

$("adminToggle").onclick=()=>{
  $("adminPanel").classList.toggle("hidden");
  $("adminPanel").scrollIntoView({behavior:"smooth",block:"start"});
};
$("loginForm").onsubmit=async e=>{
  e.preventDefault();
  try{
    await api("/api/admin/login",{method:"POST",body:JSON.stringify({id:$("adminId").value.trim(),password:$("adminPassword").value})});
    adminLoggedIn=true;$("loginBox").classList.add("hidden");$("dashboard").classList.remove("hidden");
    $("adminToggle").textContent="Admin dashboard";$("loginMessage").textContent="";
    await refreshDashboard();
  }catch(err){$("loginMessage").innerHTML=`<p style="color:#b42318">${esc(err.message)}</p>`;}
};
$("logout").onclick=async()=>{
  try{await api("/api/admin/logout",{method:"POST",body:"{}"});}catch{}
  adminLoggedIn=false;$("dashboard").classList.add("hidden");$("loginBox").classList.remove("hidden");
  $("adminPassword").value="";$("adminToggle").textContent="Admin Login";
};
$("refreshAdmin").onclick=()=>refreshDashboard().catch(showError);

async function refreshDashboard(){
  const [bookingData,equipmentData]=await Promise.all([api("/api/admin/bookings"),api("/api/admin/equipment")]);
  $("bookingCount").textContent=bookingData.bookings.length;
  $("equipmentCount").textContent=equipmentData.equipment.length;
  $("adminBookings").innerHTML=bookingData.bookings.length?bookingData.bookings.map(b=>`<tr><td>${esc(b.id)}</td><td>${esc(b.name)}</td><td>${esc(b.roll)}</td><td>${esc(b.facility)}</td><td>${esc(b.date)}</td><td>${esc(b.slot)}</td><td><button class="outline" onclick="cancelBooking('${esc(b.id)}')">Cancel</button></td></tr>`).join(""):'<tr><td colspan="7">No bookings yet.</td></tr>';
  $("adminEquipment").innerHTML=equipmentData.equipment.length?equipmentData.equipment.map(item=>{
    const overdue=!item.returned&&new Date(item.due)<new Date();
    const status=item.returned?'Returned':overdue?'Overdue':'Borrowed';
    return `<tr><td>${esc(item.id)}</td><td>${esc(item.roll)}</td><td>${esc(item.item)}</td><td>${esc(new Date(item.due).toLocaleString())}</td><td><span class="status ${item.returned?'done':''}">${status}</span></td><td>${item.returned?'—':`<button class="outline" onclick="markReturned('${esc(item.id)}')">Mark returned</button>`}</td></tr>`;
  }).join(""):'<tr><td colspan="6">No equipment records yet.</td></tr>';
}
window.cancelBooking=async id=>{
  if(!confirm("Cancel this booking?"))return;
  try{await api("/api/admin/bookings/"+encodeURIComponent(id),{method:"DELETE"});await refreshDashboard();await renderSlots();}catch(err){showError(err);}
};
window.markReturned=async id=>{
  try{await api("/api/admin/equipment/"+encodeURIComponent(id)+"/return",{method:"POST",body:"{}"});await refreshDashboard();}catch(err){showError(err);}
};
(async()=>{
  try{
    const me=await api("/api/admin/me");
    if(me.isAdmin){adminLoggedIn=true;$("loginBox").classList.add("hidden");$("dashboard").classList.remove("hidden");$("adminToggle").textContent="Admin dashboard";await refreshDashboard();}
    await renderSlots();
  }catch(err){console.error(err);}
})();
