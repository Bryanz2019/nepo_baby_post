import catmeme from '../assets/catmeme.gif';
import Button from '../components/Button';
import NepoTitlesTable from '../components/NepoTitlesTable';
import LeftPanel from '../components/LeftPanel';

function Demo() {
  return (
    <div className='flex flex-col items-center justify-center gap-4 h-full w-full'>
      <img src={catmeme} alt="Nepo logo" />
      <div>Custom Button Demo</div>
      <div>'Just some examples, go crazy!'</div>
      <div className='flex flex-row items-center justify-center gap-2'>
        <Button className="m-2">Inactive until Clicked</Button>
        <Button className="always-active m-2">Always Active</Button>
        <Button className="always-active m-2 border-8">Always Active With Border</Button>
        <Button className="m-2 text-orange-500">Orange Text</Button>
        <Button className="border-0">No Border</Button>
        <Button className="border-0 w-12 h-4.5 flex items-end bg-yellow-700 text-panel">Director</Button>
        <Button className="border-0 always-active w-80">Always Active With Different Size</Button>
      </div>

      {/* Panel + Table demo */}
      <div className='flex flex-row w-full max-w-6xl px-8 mt-4' style={{ alignItems: 'flex-start' }}>
        <LeftPanel>
         
        </LeftPanel>

        <div className='flex-1 min-w-0'>
          <NepoTitlesTable />
        </div>
      </div>
    </div>
  );
}

export default Demo;