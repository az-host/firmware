var ChosenProduct;
var device = null;

function openTab(evt, tabNum){

	var tabLinks = document.getElementsByClassName("tab-link");
	// Clear all tab statuses
	for (let i = 0; i < tabLinks.length; i++) {
		tabLinks[i].classList.remove('active-tab-link');
		tabLinks[i].classList.remove('inactive-tab-link');
	}	
	// Assign active to event element
	evt.currentTarget.classList.add('active-tab-link');
	// assign inactive to all other elements
	for (let i = 0; i < tabLinks.length; i++) {
		if(!(tabLinks[i].classList.contains('active-tab-link'))){
			tabLinks[i].classList.add('inactive-tab-link');
		}
	}	

	if(tabNum == 1){
		document.getElementById('tab1-content').style.display = 'block';
		document.getElementById('tab2-content').style.display = 'none';
	} else if(tabNum == 2){
		document.getElementById('tab1-content').style.display = 'none';
		document.getElementById('tab2-content').style.display = 'block';
	}
}

/* If the user clicks anywhere outside the select box,
then close all select boxes: */
function closeAllSelect(elmnt){
	/* A function that will close all select boxes in the document,
	except the current select box: */
	var x, y, i, xl, yl, arrNo = [];
	x = document.getElementsByClassName("select-items");
	y = document.getElementsByClassName("select-selected");
	xl = x.length;
	yl = y.length;
	for (i = 0; i < yl; i++){
		if (elmnt == y[i]){
			arrNo.push(i)
		} 
		else{
			y[i].classList.remove("select-arrow-active");
		}
	}
	for (i = 0; i < xl; i++){
		if (arrNo.indexOf(i)){
			x[i].classList.add("select-hide");
		}
	}
	updateProduct();
}

function doCustomSelect(){
	var x, i, j, l, ll, selElmnt, a, b, c;
   /* Look for any elements with the class "custom-select": */
   x = document.getElementsByClassName("custom-select");
   l = x.length;
   for (i = 0; i < l; i++) {
		selElmnt = x[i].getElementsByTagName("select")[0];
		ll = selElmnt.length;
		/* For each element, create a new DIV that will act as the selected item: */
		a = document.createElement("DIV");
		a.setAttribute("class", "select-selected");
		a.innerHTML = selElmnt.options[selElmnt.selectedIndex].innerHTML;
		x[i].appendChild(a);
		/* For each element, create a new DIV that will contain the option list: */
		b = document.createElement("DIV");
		b.setAttribute("class", "select-items select-hide");
		for (j = 1; j < ll; j++) {
			/* For each option in the original select element,
			create a new DIV that will act as an option item: */
			c = document.createElement("DIV");
			c.innerHTML = selElmnt.options[j].innerHTML;
			c.addEventListener("click", function(e){
				/* When an item is clicked, update the original select box,
				and the selected item: */
				var y, i, k, s, h, sl, yl;
				s = this.parentNode.parentNode.getElementsByTagName("select")[0];
				sl = s.length;
				h = this.parentNode.previousSibling;
				for (i = 0; i < sl; i++) {
					if (s.options[i].innerHTML == this.innerHTML){
						s.selectedIndex = i;
						h.innerHTML = this.innerHTML;
						y = this.parentNode.getElementsByClassName("same-as-selected");
						yl = y.length;
					   for (k = 0; k < yl; k++) {
							y[k].removeAttribute("class");
						}
						this.setAttribute("class", "same-as-selected");
						break;
					}	
				}
				h.click();
			});
			b.appendChild(c);
		}
		x[i].appendChild(b);
		a.addEventListener("click", function(e) {
			/* When the select box is clicked, close any other select boxes,
			and open/close the current select box: */
			e.stopPropagation();
			closeAllSelect(this);
			this.nextSibling.classList.toggle("select-hide");
			this.classList.toggle("select-arrow-active");
		});
	}	
};

function updateProduct(){
	ChosenProduct = document.getElementsByClassName('select-selected')[0].textContent;
	console.log(ChosenProduct);

	if(ChosenProduct === "Wave Packets"){
		document.getElementById("wp-guide").style.display = "block";
	}
	else{
		document.getElementById("wp-guide").style.display = "none";
	}
};	

function getDFUDescriptorProperties(device) {
	// Attempt to read the DFU functional descriptor
	// TODO: read the selected configuration's descriptor
	return device.readConfigurationDescriptor(0).then(
		data => {
			let configDesc = dfu.parseConfigurationDescriptor(data);
			let funcDesc = null;
			let configValue = device.settings.configuration.configurationValue;
			if (configDesc.bConfigurationValue == configValue) {
				for (let desc of configDesc.descriptors) {
					if (desc.bDescriptorType == 0x21 && desc.hasOwnProperty("bcdDFUVersion")) {
						funcDesc = desc;
						break;
					}
				}
			}

			if (funcDesc) {
				return {
					WillDetach:            ((funcDesc.bmAttributes & 0x08) != 0),
					ManifestationTolerant: ((funcDesc.bmAttributes & 0x04) != 0),
					CanUpload:             ((funcDesc.bmAttributes & 0x02) != 0),
					CanDnload:             ((funcDesc.bmAttributes & 0x01) != 0),
					TransferSize:          funcDesc.wTransferSize,
					DetachTimeOut:         funcDesc.wDetachTimeOut,
					DFUVersion:            funcDesc.bcdDFUVersion
				};
			} else {
				return {};
			}
		},
		error => {}
	);
}

async function fixInterfaceNames(device_, interfaces) {
	// Check if any interface names were not read correctly
	if (interfaces.some(intf => (intf.name == null))) {
		// Manually retrieve the interface name string descriptors
		let tempDevice = new dfu.Device(device_, interfaces[0]);
		await tempDevice.device_.open();
		await tempDevice.device_.selectConfiguration(1);
		let mapping = await tempDevice.readInterfaceNames();
		await tempDevice.close();

		for (let intf of interfaces) {
			if (intf.name === null) {
				let configIndex = intf.configuration.configurationValue;
				let intfNumber = intf["interface"].interfaceNumber;
				let alt = intf.alternate.alternateSetting;
				intf.name = mapping[configIndex][intfNumber][alt];
			}
		}
	}
}

async function connectToDevice(device){
	try {
		await device.open();
	} catch (error) {
		onUSBDisconnect(error);
		throw error;
	}
	return device;
}	

function reassureCorrectDevice(device){

	let verified = true;

	// Is it DFU SE
	if(!(device.properties.DFUVersion == 0x011a && device.settings.alternate.interfaceProtocol == 0x02)){
		verified = false;
	}

	// Is it 512KB
	let flashSize = 0;
	for (let segment of device.memoryInfo.segments) {
		flashSize += segment.end - segment.start;
	}
	if(flashSize != 524288){
		verified = false
	}

	return verified;
};	

function onUSBDisconnect(){
	let connectButton = document.getElementById("connect");
	connectButton.textContent = 'CONNECT';
	connectButton.style.backgroundColor = "#348f6c";
	document.getElementById("extra-connect-text").textContent = "to STM32 BOOTLOADER";

	document.getElementById("status").textContent = 'Browser not connected to module';
	document.getElementById("check").style.opacity = "30%";
	document.getElementById("update").style.opacity = "30%";
}

function displayProgress(wayThrough, total){
	let progBar = document.getElementById("progbar");
	progBar.style.display = "block";
	progBar.value = wayThrough;
	progBar.max = total;
}

function displayProgressInfo(message){
	let progInfo = document.getElementById("proginfo");

	if(message === "Erasing DFU device memory"){
		progInfo.textContent = "Erasing ARM device memory";
	}
	else if(message === "Copying data from browser to DFU device"){
		progInfo.textContent = "Flashing ARM device memory with firmware binary";
	}
	else{
		progInfo.textContent = message;
	}	
}

function logDebug(message){
	console.log(message);
}


document.addEventListener("DOMContentLoaded", events => { 
	document.getElementById("default-tab").click();

	doCustomSelect();
	// Re-enable for closing dropdown clicking elsewhere!
	// document.addEventListener("click", function(){
	// 	closeAllSelect();
	// 	updateProduct();
	// })

	let binaryFile = null;

	let checkButton = document.getElementById("check");
	let updateButton = document.getElementById("update");
	let statusMsg = document.getElementById("status");

	let connectButton = document.getElementById("connect");
	connectButton.addEventListener("click", function(){
		if(device){
			device.close().then(onUSBDisconnect);
			device = null;
		}
		else{
			const filters = [
				{
				vendorId: 0x0483, 
				productId: 0xdf11, 
				serialNumber: 'STM32FxSTM32'
				}
			] 

			navigator.usb.requestDevice({'filters': filters }).then(
				async selectedDevice => {
					let interfaces = dfu.findDeviceDfuInterfaces(selectedDevice);
					if(interfaces.length != 0) {
						await fixInterfaceNames(selectedDevice, interfaces);
						device = await connectToDevice(new dfu.Device(selectedDevice, interfaces[0]));
						device = new dfuse.Device(device.device_, device.settings);

						// Read functional descriptor through configuration descriptor
						// and store as device 'properties'
						let desc = {};
						try {
							desc = await getDFUDescriptorProperties(device);
						} catch (error){
							onUSBDisconnect(error);
							throw error;
						}
						if (desc && Object.keys(desc).length > 0){
							device.properties = desc;
						}	

						if(reassureCorrectDevice(device) == false){
							onUSBDisconnect();
						}
						else{
							checkButton.style.opacity = "100%";
							updateButton.style.opacity = "100%";
							statusMsg.textContent = 'Connected to module'
							connectButton.textContent = 'DISCONNECT';
							connectButton.style.backgroundColor = "#ff4d4d";
							document.getElementById("extra-connect-text").textContent = '';

							console.log(device.memoryInfo);
							console.log("Product name: " + selectedDevice.productName);
							console.log(device.device_.opened);
						}	

						displayProgressInfo("");
						document.getElementById("progbar").style.display = "none";
						

						navigator.usb.addEventListener("disconnect", onUSBDisconnect);
					}
				}
			)
		}	
	})

	updateButton.addEventListener("click", async function(event){
		event.preventDefault();
        event.stopPropagation();

		let response = await fetch('binaries/wave-packets/wavepackets_1_0_3.bin');
		binaryFile = await response.arrayBuffer();
		console.log(binaryFile);

		if (device && binaryFile != null) {
			device.logProgress = displayProgress;
			device.logDebug = logDebug;
			device.logInfo = displayProgressInfo;
            device.logWarning = logDebug;
            device.logError = logDebug;

			try {
				let status = await device.getStatus();
				if (status.state == dfu.dfuERROR) {
					await device.clearStatus();
				}
			} catch (error) {
				device.logWarning("Failed to clear status");
			}

			await device.do_download(device.properties.TransferSize, binaryFile, device.properties.ManifestationTolerant).then(
				() => {
					console.log("Done!");
					displayProgressInfo("Successful! The module has restarted with the new firmware")
					
				},
				error => {
					displayProgressInfo("Unsuccessful. Contact Auza for assistance.")
				}
			)
		}	
	})	
});	


