import type { BaselineRecord, BaselineStat, BaselineStats, FeatureVector, HealthSession, Recommendation, SafetyResult } from './healthTypes';

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const keys: (keyof FeatureVector)[]=['observationQuality','lighting','voiceConfidence','voiceRms','voicePauseRatio','inquiryBurden','sleepStress','tongueQuality'];

export function extractFeatures(session:HealthSession):FeatureVector{
  const samples=session.listening?.samples||[];
  const avg=(f:(s:(typeof samples)[number])=>number)=>samples.length?samples.reduce((a,s)=>a+f(s),0)/samples.length:0;
  const answers=session.inquiry?.answers||[];
  const burden=answers.length?answers.filter(a=>a.value===true||(typeof a.value==='number'&&a.value>=4)||(a.id==='han-nhiet'&&a.value!=='normal')).length/answers.length:0;
  const sleep=answers.find(a=>a.id==='ngu');
  const stress=answers.find(a=>a.id==='cam-xuc');
  const sleepStress=clamp((((typeof sleep?.value==='number'?6-sleep.value:1)+(typeof stress?.value==='number'?stress.value:1))-2)/8);
  return {
    observationQuality:session.observation?.quality||0,
    lighting:session.observation?.lighting||0,
    voiceConfidence:session.listening?.confidence||0,
    voiceRms:avg(s=>s.rms),
    voicePauseRatio:avg(s=>s.pauseRatio),
    inquiryBurden:burden,
    sleepStress,
    tongueQuality:session.tongue?.quality||0,
  };
}

const emptyStat=():BaselineStat=>({n:0,mean:0,m2:0});
export function emptyBaseline(userId:string):BaselineRecord{
  return {userId,sessionCount:0,featureStats:Object.fromEntries(keys.map(k=>[k,emptyStat()])) as BaselineStats};
}

export function updateBaseline(previous:BaselineRecord|undefined,features:FeatureVector,capturedAt:string):BaselineRecord{
  const base=previous?structuredClone(previous):emptyBaseline('');
  const stats=base.featureStats||emptyBaseline(base.userId).featureStats;
  for(const key of keys){
    const value=features[key]; const old=stats[key]||emptyStat(); const n=old.n+1; const delta=value-old.mean; const mean=old.mean+delta/n; const delta2=value-mean;
    stats[key]={n,mean,m2:old.m2+delta*delta2};
  }
  return {...base,sessionCount:(base.sessionCount||0)+1,featureStats:stats,lastSessionAt:capturedAt};
}

export function deviationScores(features:FeatureVector,baseline?:BaselineRecord){
  const out:Record<string,number>={};
  if(!baseline||baseline.sessionCount<3)return out;
  for(const key of keys){
    const st=baseline.featureStats[key]; if(!st||st.n<3)continue;
    const sd=Math.sqrt(st.m2/Math.max(1,st.n-1)); const floor=key==='voiceRms'?0.01:0.08;
    out[key]=clamp(Math.abs(features[key]-st.mean)/Math.max(sd,floor)/3);
  }
  return out;
}

export function evaluateSafety(session:HealthSession):SafetyResult{
  const urgent=session.safetyAnswers?.filter(a=>a.value).map(a=>a.id)||[];
  if(urgent.length)return {severity:'urgent',flags:urgent,message:'Có dấu hiệu cảnh báo cần được đánh giá y tế khẩn cấp. Không dựa vào ứng dụng để trì hoãn cấp cứu.'};
  const watch=(session.inquiry?.answers||[]).filter(a=>a.value===true).map(a=>a.id);
  return watch.length>=3
    ?{severity:'watch',flags:watch,message:'Có nhiều thay đổi chủ quan trong hôm nay. Nên theo dõi sát và đi khám nếu kéo dài hoặc tăng lên.'}
    :{severity:'info',flags:watch,message:'Chưa phát hiện cờ đỏ từ bộ sàng lọc hiện tại.'};
}

export function fuseSession(session:HealthSession,baseline?:BaselineRecord){
  const featureVector=extractFeatures(session); const deviations=deviationScores(featureVector,baseline);
  const quality=clamp((featureVector.observationQuality+featureVector.voiceConfidence+featureVector.tongueQuality)/3);
  const trendScore=Object.values(deviations).length?Object.values(deviations).reduce((a,b)=>a+b,0)/Object.values(deviations).length:0;
  const riskScore=clamp(featureVector.inquiryBurden*.5+featureVector.sleepStress*.2+trendScore*.3);
  const signals:string[]=[];
  if(featureVector.inquiryBurden>.3)signals.push('Nhiều triệu chứng chủ quan hơn mức nền trong phiên hôm nay.');
  if(featureVector.sleepStress>.55)signals.push('Giấc ngủ/căng thẳng có tín hiệu cần theo dõi.');
  if(trendScore>.45)signals.push('Một số chỉ số lệch đáng kể so với baseline cá nhân.');
  if(featureVector.observationQuality<.55)signals.push('Chất lượng dữ liệu Vọng còn thấp; nên đo lại trong điều kiện sáng ổn định.');
  const safety=evaluateSafety(session);
  const recommendation:Recommendation=safety.severity==='urgent'
    ?{level:'seek-care',items:['Liên hệ cơ sở y tế/cấp cứu phù hợp ngay nếu triệu chứng đang xảy ra.','Không tự điều trị chỉ dựa trên kết quả ứng dụng.'],diagnosticDirection:['Ưu tiên loại trừ tình trạng cấp tính trước khi diễn giải theo YHCT.']}
    :riskScore>.55||safety.severity==='watch'
      ?{level:'monitor',items:['Lặp lại Tứ Chẩn trong điều kiện tương tự vào ngày kế tiếp.','Nếu triệu chứng kéo dài, tăng dần hoặc ảnh hưởng sinh hoạt, nên được nhân viên y tế đánh giá trực tiếp.'],diagnosticDirection:['Định hướng theo dõi các nhóm triệu chứng nổi bật và xu hướng so với baseline cá nhân; chưa đủ cơ sở để kết luận bệnh danh.']}
      :{level:'routine',items:['Duy trì nhịp ngủ, vận động, ăn uống và thời điểm đo tương đối ổn định.','Theo dõi xu hướng nhiều ngày thay vì một kết quả đơn lẻ.'],diagnosticDirection:['Chưa có tín hiệu đủ mạnh để gợi ý một bệnh danh cụ thể.']};
  return {featureVector,fusion:{confidence:clamp(.45+quality*.45+(baseline?.sessionCount?0.1:0)),riskScore,trendScore,deviations,summary:riskScore>.55?'Có thay đổi đáng chú ý cần theo dõi so với dữ liệu hiện tại.':'Chưa ghi nhận thay đổi nổi bật cần cảnh báo từ dữ liệu hiện tại.',signals},safety,recommendation};
}
